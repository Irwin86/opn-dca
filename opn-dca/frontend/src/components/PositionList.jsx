import { useReadContract, useWriteContract } from "wagmi";
import { DCA_VAULT_ADDRESS } from "../config";
import { DCA_VAULT_ABI } from "../abi";
import styles from "./PositionList.module.css";

function formatInterval(seconds) {
  const n = Number(seconds);
  if (n >= 604800) return `${Math.round(n / 604800)}w`;
  if (n >= 86400)  return `${Math.round(n / 86400)}d`;
  if (n >= 3600)   return `${Math.round(n / 3600)}h`;
  return `${Math.round(n / 60)}m`;
}

function shorten(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

function PositionCard({ positionId }) {
  const { data: pos } = useReadContract({
    address: DCA_VAULT_ADDRESS,
    abi: DCA_VAULT_ABI,
    functionName: "positions",
    args: [positionId],
  });
  const { data: balance } = useReadContract({
    address: DCA_VAULT_ADDRESS,
    abi: DCA_VAULT_ABI,
    functionName: "positionBalance",
    args: [positionId],
  });
  const { data: swapDue } = useReadContract({
    address: DCA_VAULT_ADDRESS,
    abi: DCA_VAULT_ABI,
    functionName: "isSwapDue",
    args: [positionId],
  });

  const { writeContract, isPending } = useWriteContract();

  if (!pos) return null;

  const [owner, fromToken, toToken, amountPerSwap, intervalSeconds, , , totalSpent, totalReceived, active] = pos;

  if (!active) return null;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.pair}>
          <span className={styles.token}>{shorten(fromToken)}</span>
          <span className={styles.arrow}>→</span>
          <span className={styles.token}>{shorten(toToken)}</span>
        </div>
        <span className={swapDue ? styles.badgeDue : styles.badgeWaiting}>
          {swapDue ? "● Swap due" : "○ Waiting"}
        </span>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Per swap</span>
          <span className={styles.statVal}>{(Number(amountPerSwap) / 1e6).toFixed(2)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Interval</span>
          <span className={styles.statVal}>{formatInterval(intervalSeconds)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Balance</span>
          <span className={styles.statVal}>{balance ? (Number(balance) / 1e6).toFixed(2) : "—"}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Total spent</span>
          <span className={styles.statVal}>{(Number(totalSpent) / 1e6).toFixed(2)}</span>
        </div>
      </div>

      <div className={styles.actions}>
        {swapDue && (
          <button
            className={styles.btnExecute}
            disabled={isPending}
            onClick={() =>
              writeContract({
                address: DCA_VAULT_ADDRESS,
                abi: DCA_VAULT_ABI,
                functionName: "executeSwap",
                args: [positionId, 0n, [fromToken, toToken]],
              })
            }
          >
            {isPending ? "Executing…" : "Execute Swap ⚡"}
          </button>
        )}
        <button
          className={styles.btnClose}
          disabled={isPending}
          onClick={() =>
            writeContract({
              address: DCA_VAULT_ADDRESS,
              abi: DCA_VAULT_ABI,
              functionName: "closePosition",
              args: [positionId],
            })
          }
        >
          Close & Withdraw
        </button>
      </div>
    </div>
  );
}

export default function PositionList({ address, onCreateNew }) {
  const { data: positionIds, isLoading } = useReadContract({
    address: DCA_VAULT_ADDRESS,
    abi: DCA_VAULT_ABI,
    functionName: "getUserPositions",
    args: [address],
  });

  if (isLoading) {
    return <div className={styles.empty}>Loading positions…</div>;
  }

  if (!positionIds || positionIds.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>◈</div>
        <h3>No positions yet</h3>
        <p>Create your first DCA position to start automating your investment strategy.</p>
        <button className={styles.btnCreate} onClick={onCreateNew}>
          Create First Position →
        </button>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {positionIds.map((id) => (
        <PositionCard key={id.toString()} positionId={id} />
      ))}
    </div>
  );
}
