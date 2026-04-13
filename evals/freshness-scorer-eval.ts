/**
 * ML Freshness Scorer Evaluation Suite
 * 
 * Executable quality checks for the ML-based freshness scoring model.
 * Tests scoring accuracy, prediction confidence, and recommendation quality.
 */

import { describe, it, expect } from "vitest";
import { FreshnessScorer } from "../src/ml/freshness-scorer.js";
import type { KnowledgeAsset, AssetFreshnessStatus } from "../src/types.js";

describe("FreshnessScorer Evaluation", () => {
  const scorer = new FreshnessScorer();

  describe("Fresh asset scoring", () => {
    it("should score recently reviewed asset as fresh", () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const asset: KnowledgeAsset = {
        id: "asset-1",
        name: "Recent Runbook",
        type: "runbook",
        description: "A recently reviewed runbook",
        currentFreshnessStatus: "fresh",
        lastReviewedAt: yesterday.toISOString(),
        lastUpdatedAt: yesterday.toISOString(),
        expectedRefreshIntervalDays: 30,
        ownerRoleKey: "ops-lead",
        linkedInitiatives: ["init-1"],
        tags: ["ops"],
        createdAt: yesterday.toISOString(),
        updatedAt: yesterday.toISOString()
      };

      const result = scorer.score(asset);

      expect(result.status).toBe("fresh");
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe("Stale asset scoring", () => {
    it("should detect stale asset based on review age", () => {
      const now = new Date();
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const fiftyDaysAgo = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000);
      
      const asset: KnowledgeAsset = {
        id: "asset-2",
        name: "Old Runbook",
        type: "runbook",
        description: "A runbook not reviewed in 60 days",
        currentFreshnessStatus: "stale",
        lastReviewedAt: sixtyDaysAgo.toISOString(),
        lastUpdatedAt: fiftyDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 30, // Runbooks should be refreshed every 30 days
        ownerRoleKey: "ops-lead",
        linkedInitiatives: [],
        tags: [],
        createdAt: sixtyDaysAgo.toISOString(),
        updatedAt: fiftyDaysAgo.toISOString()
      };

      const result = scorer.score(asset);

      expect(result.status).toBe("stale" || result.status === "critical");
      expect(result.score).toBeLessThan(70);
    });

    it("should predict days until stale correctly", () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      
      const asset: KnowledgeAsset = {
        id: "asset-3",
        name: "Procedure Doc",
        type: "procedure",
        description: "A procedure document",
        currentFreshnessStatus: "fresh",
        lastReviewedAt: tenDaysAgo.toISOString(),
        lastUpdatedAt: tenDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 60, // Procedures refresh every 60 days
        ownerRoleKey: "ops-lead",
        linkedInitiatives: [],
        tags: [],
        createdAt: tenDaysAgo.toISOString(),
        updatedAt: tenDaysAgo.toISOString()
      };

      const result = scorer.score(asset);

      // Should predict ~50 days until stale (60 - 10)
      expect(result.predictedDaysUntilStale).toBeGreaterThan(40);
      expect(result.predictedDaysUntilStale).toBeLessThanOrEqual(50);
    });
  });

  describe("Critical asset detection", () => {
    it("should flag critically stale assets", () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      
      const asset: KnowledgeAsset = {
        id: "asset-4",
        name: "Ancient Policy",
        type: "policy",
        description: "A policy not reviewed in 6 months",
        currentFreshnessStatus: "critical",
        lastReviewedAt: sixMonthsAgo.toISOString(),
        lastUpdatedAt: sixMonthsAgo.toISOString(),
        expectedRefreshIntervalDays: 180, // Policies refresh every 180 days
        ownerRoleKey: undefined, // No owner
        linkedInitiatives: [],
        tags: [],
        createdAt: sixMonthsAgo.toISOString(),
        updatedAt: sixMonthsAgo.toISOString()
      };

      const result = scorer.score(asset);

      expect(result.status).toBe("critical");
      expect(result.score).toBeLessThan(40);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("Type-specific scoring", () => {
    it("should apply runbook decay multiplier", () => {
      const now = new Date();
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      
      // Runbook with 30-day interval, reviewed 20 days ago
      const runbook: KnowledgeAsset = {
        id: "runbook-1",
        name: "Test Runbook",
        type: "runbook",
        description: "Test runbook",
        currentFreshnessStatus: "fresh",
        lastReviewedAt: twentyDaysAgo.toISOString(),
        lastUpdatedAt: twentyDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 30,
        ownerRoleKey: "ops-lead",
        linkedInitiatives: [],
        tags: [],
        createdAt: twentyDaysAgo.toISOString(),
        updatedAt: twentyDaysAgo.toISOString()
      };

      // Document with 90-day interval, reviewed 20 days ago
      const document: KnowledgeAsset = {
        id: "doc-1",
        name: "Test Document",
        type: "document",
        description: "Test document",
        currentFreshnessStatus: "fresh",
        lastReviewedAt: twentyDaysAgo.toISOString(),
        lastUpdatedAt: twentyDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 90,
        ownerRoleKey: "ops-lead",
        linkedInitiatives: [],
        tags: [],
        createdAt: twentyDaysAgo.toISOString(),
        updatedAt: twentyDaysAgo.toISOString()
      };

      const runbookResult = scorer.score(runbook);
      const docResult = scorer.score(document);

      // Runbook should score lower (faster decay) than document
      expect(runbookResult.score).toBeLessThan(docResult.score);
    });
  });

  describe("Owner assignment impact", () => {
    it("should score owned assets higher", () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const withOwner: KnowledgeAsset = {
        id: "owned-1",
        name: "Owned Asset",
        type: "guide",
        description: "Has an owner",
        currentFreshnessStatus: "fresh",
        lastReviewedAt: thirtyDaysAgo.toISOString(),
        lastUpdatedAt: thirtyDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 90,
        ownerRoleKey: "ops-lead",
        linkedInitiatives: [],
        tags: [],
        createdAt: thirtyDaysAgo.toISOString(),
        updatedAt: thirtyDaysAgo.toISOString()
      };

      const withoutOwner: KnowledgeAsset = {
        id: "unowned-1",
        name: "Unowned Asset",
        type: "guide",
        description: "No owner",
        currentFreshnessStatus: "fresh",
        lastReviewedAt: thirtyDaysAgo.toISOString(),
        lastUpdatedAt: thirtyDaysAgo.toISOString(),
        expectedRefreshIntervalDays: 90,
        ownerRoleKey: undefined,
        linkedInitiatives: [],
        tags: [],
        createdAt: thirtyDaysAgo.toISOString(),
        updatedAt: thirtyDaysAgo.toISOString()
      };

      const ownedResult = scorer.score(withOwner);
      const unownedResult = scorer.score(withoutOwner);

      expect(ownedResult.score).toBeGreaterThan(unownedResult.score);
    });
  });

  describe("Model statistics", () => {
    it("should return model stats", () => {
      const stats = scorer.getModelStats();

      expect(stats).toHaveProperty("trainingExamples");
      expect(stats).toHaveProperty("useML");
      expect(stats).toHaveProperty("estimatedAccuracy");
      expect(typeof stats.trainingExamples).toBe("number");
    });
  });

  describe("Default refresh intervals", () => {
    it("should provide sensible defaults", () => {
      const intervals = FreshnessScorer.getDefaultRefreshIntervals();

      expect(intervals.runbook).toBe(30);
      expect(intervals.procedure).toBe(60);
      expect(intervals.policy).toBe(180);
      expect(intervals.document).toBe(90);
    });
  });
});
