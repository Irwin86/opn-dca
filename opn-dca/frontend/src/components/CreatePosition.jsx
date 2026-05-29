import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { DCA_VAULT_ADDRESS } from "../config";
import { DCA_VAULT_ABI } from "../abi";
import styles from "./CreatePosition.module.css";

const INTERVAL_OPTIONS = [
  { label: "Every hour",   value: 3600 },
  { label: "Every 6h",    value: 21600 },
  { label: "Every day",   value: 86400 },
  { label: "Every week",  value: 604800 },
];

export default function CreatePosition({ onSuccess }) {
  const [fromToken, setFromToken] = useState("");
  const [toToken, setToToken] = useState("");
  const [amountPerSwap, setAmountPerSwap] = useState("");
  const [interval, setInterval] = useState(86400);
  const [initialDeposit, setInitialDeposit] = useState("");
  const [decimals, setDecimals] = useState(18);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  if (isSuccess) {
    onSuccess?.();
  }

  const handleSubmit = () => {
    if (!fromToken || !toToken || !amountPerSwap) return;
    writeContract({
      address: DCA_VAULT_ADDRESS,
      abi: DCA_VAULT_ABI,
      functionName: "createPosition",
      args: [
        fromToken,
        toToken,
        parseUnits(amountPerSwap, decimals),
        BigInt(interval),
        initialDeposit ? parseUnits(initialDeposit, decimals) : 0n,
      ],
    });
  };

  const busy = isPending || isConfirming;

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Create DCA Position</h2>
      <p className={styles.sub}>
        Set your token pair, swap amount, and interval. Deposits go to the vault — 
        swaps execute automatically once each interval elapses.
      </p>

      <div className={styles.grid}>
        <div className={styles.field}>
          <label>From Token (address)</label>
          <input
            placeholder="0xUSDC…"
            value={fromToken}
            onChange={e => setFromToken(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label>To Token (address)</label>
          <input
            placeholder="0xWETH…"
            value={toToken}
            onChange={e => setToToken(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label>Token Decimals</label>
          <input
            type="number"
            placeholder="18"
            value={decimals}
            onChange={e => setDecimals(Number(e.target.value))}
          />
        </div>
        <div className={styles.field}>
          <label>Amount Per Swap</label>
          <input
            type="number"
            placeholder="100"
            value={amountPerSwap}
            onChange={e => setAmountPerSwap(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label>Swap Interval</label>
          <select value={interval} onChange={e => setInterval(Number(e.target.value))}>
            {INTERVAL_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label>Initial Deposit (optional)</label>
          <input
            type="number"
            placeholder="1000"
            value={initialDeposit}
            onChange={e => setInitialDeposit(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.info}>
        <div className={styles.infoRow}>
          <span>Protocol fee</span><span className="mono">0.3%</span>
        </div>
        <div className={styles.infoRow}>
          <span>Keeper reward</span><span className="mono">0.1%</span>
        </div>
        <div className={styles.infoRow}>
          <span>Swaps per deposit</span>
          <span className="mono">
            {amountPerSwap && initialDeposit
              ? Math.floor(Number(initialDeposit) / Number(amountPerSwap))
              : "—"}
          </span>
        </div>
      </div>

      <button
        className={styles.btn}
        onClick={handleSubmit}
        disabled={busy || !fromToken || !toToken || !amountPerSwap}
      >
        {busy ? "Confirming…" : "Create Position →"}
      </button>

      {txHash && (
        <p className={styles.txLink}>
          Tx:{" "}
          <a
            href={`https://testnet-explorer.opnchain.io/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            {txHash.slice(0, 20)}…
          </a>
        </p>
      )}
    </div>
  );
}
