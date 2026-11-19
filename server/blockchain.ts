import type { CryptoCurrency, PaymentStatus, WalletAddressConfig } from '../src/types.ts';

export interface VerificationResult {
  status: PaymentStatus;
  confirmations: number;
  message: string;
  observedAmount?: string;
}

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const ETH_RPC_URL = process.env.ETH_RPC_URL || 'https://ethereum-rpc.publicnode.com';
const BTC_API_URL = (process.env.BTC_API_URL || 'https://mempool.space/api').replace(/\/$/, '');

const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export function normalizeTxHash(currency: CryptoCurrency, rawHash: string): string {
  const trimmed = rawHash.trim();
  if (currency === 'SOL') return trimmed;
  return trimmed.toLowerCase();
}

export function validateTxHashFormat(currency: CryptoCurrency, txHash: string): string | null {
  if (!txHash || txHash.length < 20) {
    return 'Please enter a valid blockchain transaction hash.';
  }
  if (currency === 'SOL') {
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,92}$/.test(txHash)) {
      return 'Invalid Solana transaction signature format (expected Base58 signature).';
    }
    return null;
  }
  if (currency === 'BTC') {
    if (!/^[a-f0-9]{64}$/i.test(txHash)) {
      return 'Invalid Bitcoin transaction ID format (expected 64-character hex TXID).';
    }
    return null;
  }
  if (!/^0x[a-f0-9]{64}$/i.test(txHash)) {
    return 'Invalid Ethereum transaction hash format (expected 0x followed by 64 hex characters).';
  }
  return null;
}

async function fetchJsonWithTimeout(url: string, init?: RequestInit, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function verifySolanaTransaction(
  txHash: string,
  wallet: WalletAddressConfig,
  expectedSolAmount: string,
  orderCreatedAtIso: string
): Promise<VerificationResult> {
  const response = await fetchJsonWithTimeout(SOLANA_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [
        txHash,
        {
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        },
      ],
    }),
  });

  if (!response.ok) {
    return {
      status: 'Pending',
      confirmations: 0,
      message: `Solana RPC returned HTTP ${response.status}. Click Re-check in a few seconds.`,
    };
  }

  const payload = (await response.json()) as {
    result?: {
      blockTime?: number | null;
      meta?: {
        err: unknown;
        preBalances: number[];
        postBalances: number[];
      } | null;
      transaction?: {
        message?: {
          accountKeys?: Array<string | { pubkey: string }>;
        };
      };
    } | null;
    error?: { message?: string };
  };

  if (payload.error) {
    return {
      status: 'Pending',
      confirmations: 0,
      message: `Solana RPC error: ${payload.error.message || 'Unable to inspect transaction'}.`,
    };
  }

  const tx = payload.result;
  if (!tx) {
    return {
      status: 'Pending',
      confirmations: 0,
      message:
        'Transaction not yet confirmed on Solana Mainnet. If just broadcast, wait a few seconds and re-verify.',
    };
  }

  if (tx.meta?.err !== null) {
    return {
      status: 'Failed',
      confirmations: 0,
      message: 'Solana transaction failed on-chain (execution error).',
    };
  }

  if (tx.blockTime) {
    const orderCreatedSec = Math.floor(new Date(orderCreatedAtIso).getTime() / 1000);
    if (tx.blockTime < orderCreatedSec - 3600) {
      return {
        status: 'Failed',
        confirmations: 0,
        message: 'Transaction timestamp predates this rental order.',
      };
    }
  }

  const keys = (tx.transaction?.message?.accountKeys || []).map((k) =>
    typeof k === 'string' ? k : k.pubkey
  );
  const recipientIndex = keys.findIndex((k) => k === wallet.address);

  if (recipientIndex === -1 || !tx.meta) {
    return {
      status: 'Failed',
      confirmations: 1,
      message: `Transaction did not send funds to the required Solana wallet (${wallet.address}).`,
    };
  }

  const pre = tx.meta.preBalances[recipientIndex] ?? 0;
  const post = tx.meta.postBalances[recipientIndex] ?? 0;
  const receivedLamports = post - pre;
  const expectedLamports = Math.round(Number(expectedSolAmount) * 1_000_000_000);
  const minAcceptedLamports = Math.floor(expectedLamports * 0.99);

  if (receivedLamports <= 0) {
    return {
      status: 'Failed',
      confirmations: 1,
      message: 'No positive SOL balance transfer was credited to the receiving wallet.',
    };
  }

  if (receivedLamports < minAcceptedLamports) {
    const receivedSol = (receivedLamports / 1_000_000_000).toFixed(6);
    return {
      status: 'Failed',
      confirmations: 1,
      observedAmount: `${receivedSol} SOL`,
      message: `Insufficient amount received (${receivedSol} SOL vs ${expectedSolAmount} SOL required).`,
    };
  }

  const receivedSol = (receivedLamports / 1_000_000_000).toFixed(6);
  return {
    status: 'Confirmed',
    confirmations: 1,
    observedAmount: `${receivedSol} SOL`,
    message: `Verified ${receivedSol} SOL transfer on Solana Mainnet.`,
  };
}

async function verifyBitcoinTransaction(
  txHash: string,
  wallet: WalletAddressConfig,
  expectedBtcAmount: string
): Promise<VerificationResult> {
  const txRes = await fetchJsonWithTimeout(`${BTC_API_URL}/tx/${txHash}`);
  if (txRes.status === 404) {
    return {
      status: 'Failed',
      confirmations: 0,
      message: 'Bitcoin transaction ID was not found on Bitcoin Mainnet.',
    };
  }
  if (!txRes.ok) {
    return {
      status: 'Pending',
      confirmations: 0,
      message: `Bitcoin verification service returned HTTP ${txRes.status}. Try re-checking shortly.`,
    };
  }

  const tx = (await txRes.json()) as {
    status?: { confirmed?: boolean; block_height?: number };
    vout?: Array<{ scriptpubkey_address?: string; value?: number }>;
  };

  const matchingSats = (tx.vout || [])
    .filter((out) => out.scriptpubkey_address === wallet.address)
    .reduce((sum, out) => sum + (out.value || 0), 0);

  if (matchingSats <= 0) {
    return {
      status: 'Failed',
      confirmations: 0,
      message: `No Bitcoin output matched the receiving address (${wallet.address}).`,
    };
  }

  const expectedSats = Math.round(Number(expectedBtcAmount) * 100_000_000);
  const minAcceptedSats = Math.floor(expectedSats * 0.99);
  const receivedBtc = (matchingSats / 100_000_000).toFixed(8);

  if (matchingSats < minAcceptedSats) {
    return {
      status: 'Failed',
      confirmations: 0,
      observedAmount: `${receivedBtc} BTC`,
      message: `Insufficient BTC amount (${receivedBtc} BTC vs ${expectedBtcAmount} BTC required).`,
    };
  }

  if (!tx.status?.confirmed || !tx.status.block_height) {
    return {
      status: 'Pending',
      confirmations: 0,
      observedAmount: `${receivedBtc} BTC`,
      message: `Detected ${receivedBtc} BTC in mempool. Awaiting block confirmation (${wallet.minConfirmations} required).`,
    };
  }

  let confirmations = 1;
  try {
    const tipRes = await fetchJsonWithTimeout(`${BTC_API_URL}/blocks/tip/height`);
    if (tipRes.ok) {
      const tipHeight = Number(await tipRes.text());
      if (Number.isFinite(tipHeight) && tipHeight >= tx.status.block_height) {
        confirmations = tipHeight - tx.status.block_height + 1;
      }
    }
  } catch {
    // Keep baseline 1 confirmation since tx.status.confirmed is true
  }

  if (confirmations < wallet.minConfirmations) {
    return {
      status: 'Pending',
      confirmations,
      observedAmount: `${receivedBtc} BTC`,
      message: `Transaction has ${confirmations}/${wallet.minConfirmations} Bitcoin confirmations.`,
    };
  }

  return {
    status: 'Confirmed',
    confirmations,
    observedAmount: `${receivedBtc} BTC`,
    message: `Verified ${receivedBtc} BTC with ${confirmations} confirmation(s) on Bitcoin Mainnet.`,
  };
}

async function verifyEthereumErc20Transaction(
  txHash: string,
  wallet: WalletAddressConfig,
  expectedUsdAmount: string
): Promise<VerificationResult> {
  const rpcCall = async (method: string, params: unknown[]) => {
    const res = await fetchJsonWithTimeout(ETH_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as { result?: unknown; error?: { message?: string } };
  };

  const receiptPayload = await rpcCall('eth_getTransactionReceipt', [txHash]);
  if (receiptPayload.error) {
    return {
      status: 'Pending',
      confirmations: 0,
      message: `Ethereum RPC error: ${receiptPayload.error.message || 'Retry verification shortly'}.`,
    };
  }

  const receipt = receiptPayload.result as {
    status?: string;
    blockNumber?: string;
    logs?: Array<{ address: string; topics: string[]; data: string }>;
  } | null;

  if (!receipt) {
    const txLookup = await rpcCall('eth_getTransactionByHash', [txHash]);
    if (txLookup.result) {
      return {
        status: 'Pending',
        confirmations: 0,
        message: 'Ethereum transaction is pending in mempool. Awaiting block inclusion.',
      };
    }
    return {
      status: 'Failed',
      confirmations: 0,
      message: 'Transaction hash was not found on Ethereum Mainnet.',
    };
  }

  if (receipt.status !== '0x1') {
    return {
      status: 'Failed',
      confirmations: 0,
      message: 'Ethereum transaction failed or reverted on-chain.',
    };
  }

  const contractAddr = wallet.contractAddress?.toLowerCase();
  const targetRecipient = wallet.address.toLowerCase();
  if (!contractAddr) {
    return {
      status: 'Failed',
      confirmations: 0,
      message: 'Server token contract configuration is missing.',
    };
  }

  let receivedRawUnits = 0n;
  for (const log of receipt.logs || []) {
    if (log.address?.toLowerCase() !== contractAddr) continue;
    if (!log.topics || log.topics.length < 3) continue;
    if (log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) continue;
    const toTopic = log.topics[2]?.toLowerCase();
    const decodedTo = `0x${toTopic.slice(-40)}`;
    if (decodedTo !== targetRecipient) continue;
    if (log.data && log.data !== '0x') {
      receivedRawUnits += BigInt(log.data);
    }
  }

  const scaleFactor = 10n ** BigInt(wallet.decimals);
  const expectedUnits = BigInt(Math.round(Number(expectedUsdAmount) * Number(scaleFactor)));
  const minAcceptedUnits = (expectedUnits * 99n) / 100n;
  const receivedHuman = (Number(receivedRawUnits) / Number(scaleFactor)).toFixed(2);

  if (receivedRawUnits === 0n) {
    return {
      status: 'Failed',
      confirmations: 0,
      message: `No ${wallet.symbol} ERC20 transfer to ${wallet.address} was found in this transaction.`,
    };
  }

  if (receivedRawUnits < minAcceptedUnits) {
    return {
      status: 'Failed',
      confirmations: 0,
      observedAmount: `${receivedHuman} ${wallet.symbol}`,
      message: `Insufficient ${wallet.symbol} received (${receivedHuman} vs ${expectedUsdAmount} required).`,
    };
  }

  let confirmations = 1;
  try {
    const blockPayload = await rpcCall('eth_blockNumber', []);
    if (typeof blockPayload.result === 'string' && receipt.blockNumber) {
      const tip = parseInt(blockPayload.result, 16);
      const txBlock = parseInt(receipt.blockNumber, 16);
      if (Number.isFinite(tip) && Number.isFinite(txBlock) && tip >= txBlock) {
        confirmations = tip - txBlock + 1;
      }
    }
  } catch {
    // Keep 1 confirmation if blockNumber lookup momentarily fails
  }

  if (confirmations < wallet.minConfirmations) {
    return {
      status: 'Pending',
      confirmations,
      observedAmount: `${receivedHuman} ${wallet.symbol}`,
      message: `Transaction has ${confirmations}/${wallet.minConfirmations} Ethereum confirmations.`,
    };
  }

  return {
    status: 'Confirmed',
    confirmations,
    observedAmount: `${receivedHuman} ${wallet.symbol}`,
    message: `Verified ${receivedHuman} ${wallet.symbol} (ERC20) with ${confirmations} confirmation(s) on Ethereum Mainnet.`,
  };
}

export async function verifyBlockchainPayment(params: {
  currency: CryptoCurrency;
  txHash: string;
  wallet: WalletAddressConfig;
  expectedAmount: string;
  orderCreatedAtIso: string;
}): Promise<VerificationResult> {
  const { currency, txHash, wallet, expectedAmount, orderCreatedAtIso } = params;

  try {
    if (currency === 'SOL') {
      return await verifySolanaTransaction(txHash, wallet, expectedAmount, orderCreatedAtIso);
    }
    if (currency === 'BTC') {
      return await verifyBitcoinTransaction(txHash, wallet, expectedAmount);
    }
    return await verifyEthereumErc20Transaction(txHash, wallet, expectedAmount);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Network RPC unreachable';
    return {
      status: 'Pending',
      confirmations: 0,
      message: `Could not reach blockchain verification node (${msg}). Payment was NOT activated; retry verification shortly.`,
    };
  }
}
