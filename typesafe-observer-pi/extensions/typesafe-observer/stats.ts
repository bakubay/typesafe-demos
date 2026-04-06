export interface InteractionRecord {
  timestamp: number;
  turn: number;
  type: "user" | "assistant";
  isFrustrated?: number;
  isCorrection?: number;
  isVague?: number;
  intent?: string;
  frustration?: number;
  specificity?: number;
  inputLength?: number;
  isHedged?: number;
  isOverExplained?: number;
  responseType?: string;
  helpfulness?: number;
}

export interface PatternInsight {
  label: string;
  detail: string;
}

interface SerializedStats {
  version: 1;
  records: InteractionRecord[];
  turnCount: number;
  startTime: number;
}

const MAX_RECORDS = 500;

export class SessionStats {
  records: InteractionRecord[] = [];
  turnCount = 0;
  startTime = Date.now();

  addRecord(record: InteractionRecord) {
    this.records.push(record);
    if (this.records.length > MAX_RECORDS) {
      this.records.shift();
    }
  }

  incrementTurn() {
    this.turnCount++;
  }

  getUserRecords(): InteractionRecord[] {
    return this.records.filter((r) => r.type === "user");
  }

  getAssistantRecords(): InteractionRecord[] {
    return this.records.filter((r) => r.type === "assistant");
  }

  getConsecutiveFrustratedCount(threshold = 3.0): number {
    const userRecords = this.getUserRecords();
    let count = 0;
    for (let i = userRecords.length - 1; i >= 0; i--) {
      const f = userRecords[i].frustration;
      if (f !== undefined && f >= threshold) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  getFrustrationMovingAverage(window = 5): number {
    const userRecords = this.getUserRecords();
    if (userRecords.length === 0) return 0;

    const recent = userRecords.slice(-window);
    const scores = recent
      .map((r) => r.frustration)
      .filter((f): f is number => f !== undefined);
    if (scores.length === 0) return 0;

    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  getAverageHelpfulness(): number {
    const assistantRecords = this.getAssistantRecords();
    const scores = assistantRecords
      .map((r) => r.helpfulness)
      .filter((h): h is number => h !== undefined);
    if (scores.length === 0) return 0;

    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  getIntentBreakdown(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const r of this.getUserRecords()) {
      if (r.intent) {
        counts[r.intent] = (counts[r.intent] ?? 0) + 1;
      }
    }
    return counts;
  }

  getResponseTypeBreakdown(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const r of this.getAssistantRecords()) {
      if (r.responseType) {
        counts[r.responseType] = (counts[r.responseType] ?? 0) + 1;
      }
    }
    return counts;
  }

  detectPatterns(): PatternInsight[] {
    const insights: PatternInsight[] = [];
    const userRecords = this.getUserRecords();

    if (userRecords.length >= 3) {
      let shortThenFrustrated = 0;
      let shortCount = 0;

      for (let i = 0; i < userRecords.length - 1; i++) {
        const curr = userRecords[i];
        const next = userRecords[i + 1];
        if (curr.inputLength !== undefined && curr.inputLength < 20) {
          shortCount++;
          if (next.frustration !== undefined && next.frustration > 2.5) {
            shortThenFrustrated++;
          }
        }
      }

      if (shortCount >= 2 && shortThenFrustrated / shortCount > 0.5) {
        const pct = Math.round((shortThenFrustrated / shortCount) * 100);
        insights.push({
          label: "Short inputs correlate with frustration",
          detail: `${pct}% of short inputs (<20 chars) are followed by frustrated messages`,
        });
      }
    }

    const allRecords = this.records;
    if (allRecords.length >= 4) {
      let hedgeThenCorrection = 0;
      let hedgeCount = 0;

      for (let i = 0; i < allRecords.length - 1; i++) {
        const curr = allRecords[i];
        const next = allRecords[i + 1];
        if (curr.type === "assistant" && curr.isHedged !== undefined && curr.isHedged > 0.6) {
          hedgeCount++;
          if (next.type === "user" && next.isCorrection !== undefined && next.isCorrection > 0.5) {
            hedgeThenCorrection++;
          }
        }
      }

      if (hedgeCount >= 2 && hedgeThenCorrection / hedgeCount > 0.4) {
        const pct = Math.round((hedgeThenCorrection / hedgeCount) * 100);
        insights.push({
          label: "Hedged responses lead to corrections",
          detail: `${pct}% of hedged agent responses are followed by user corrections`,
        });
      }
    }

    if (userRecords.length >= 6) {
      const mid = Math.floor(userRecords.length / 2);
      const firstHalf = userRecords.slice(0, mid);
      const secondHalf = userRecords.slice(mid);

      const avg = (recs: InteractionRecord[]) => {
        const scores = recs.map((r) => r.frustration).filter((f): f is number => f !== undefined);
        return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      };

      const firstAvg = avg(firstHalf);
      const secondAvg = avg(secondHalf);
      const diff = secondAvg - firstAvg;

      if (diff > 0.5) {
        insights.push({
          label: "Frustration is rising",
          detail: `Average frustration went from ${firstAvg.toFixed(1)} to ${secondAvg.toFixed(1)} over the session`,
        });
      } else if (diff < -0.5) {
        insights.push({
          label: "Frustration is decreasing",
          detail: `Average frustration went from ${firstAvg.toFixed(1)} to ${secondAvg.toFixed(1)} — session is going well`,
        });
      }
    }

    return insights;
  }

  getMoodTrajectory(): { turn: number; frustration: number; helpfulness: number }[] {
    const trajectory: { turn: number; frustration: number; helpfulness: number }[] = [];
    const byTurn = new Map<number, { frustration?: number; helpfulness?: number }>();

    for (const r of this.records) {
      const existing = byTurn.get(r.turn) ?? {};
      if (r.type === "user" && r.frustration !== undefined) {
        existing.frustration = r.frustration;
      }
      if (r.type === "assistant" && r.helpfulness !== undefined) {
        existing.helpfulness = r.helpfulness;
      }
      byTurn.set(r.turn, existing);
    }

    for (const [turn, data] of [...byTurn.entries()].sort((a, b) => a[0] - b[0])) {
      trajectory.push({
        turn,
        frustration: data.frustration ?? 0,
        helpfulness: data.helpfulness ?? 0,
      });
    }

    return trajectory;
  }

  serialize(): SerializedStats {
    return {
      version: 1,
      records: this.records,
      turnCount: this.turnCount,
      startTime: this.startTime,
    };
  }

  deserialize(data: unknown) {
    if (!data || typeof data !== "object") return;
    const d = data as Partial<SerializedStats>;
    if (d.version !== 1) return;

    this.records = d.records ?? [];
    this.turnCount = d.turnCount ?? 0;
    this.startTime = d.startTime ?? Date.now();
  }

  reset() {
    this.records = [];
    this.turnCount = 0;
    this.startTime = Date.now();
  }
}
