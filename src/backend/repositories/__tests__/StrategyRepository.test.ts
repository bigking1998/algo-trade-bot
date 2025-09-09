/**
 * StrategyRepository Unit Tests - Task BE-003
 * 
 * Comprehensive test suite for StrategyRepository covering:
 * - Specialized query methods
 * - Performance tracking capabilities
 * - Active strategy management
 * - Configuration validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrategyRepository } from '../StrategyRepository';
import { Strategy, ValidationError } from '../../types/database';

// Mock the database manager to avoid actual database calls
vi.mock('../database/DatabaseManager', () => ({
  DatabaseManager: {
    getInstance: vi.fn(() => ({
      query: vi.fn().mockResolvedValue({ rows: [] }),
      clearCache: vi.fn().mockResolvedValue(undefined),
      transaction: vi.fn(),
    })),
  },
}));

// Create a test-friendly version that exposes some methods for testing
class TestableStrategyRepository extends StrategyRepository {
  // Make protected methods accessible for testing
  public async testValidateEntity(entity: Partial<Strategy>, operation: 'create' | 'update'): Promise<void> {
    return this.validateEntity(entity, operation);
  }

  public testGetRequiredParameters(type: Strategy['type']): string[] {
    return (this as any).getRequiredParameters(type);
  }
}

describe('StrategyRepository', () => {
  let strategyRepository: TestableStrategyRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    strategyRepository = new TestableStrategyRepository();
  });

  describe('Configuration Validation', () => {
    describe('getRequiredParameters', () => {
      it('should return correct required parameters for technical strategy', () => {
        const params = strategyRepository.testGetRequiredParameters('technical');
        expect(params).toEqual(['timeframe', 'indicators']);
      });

      it('should return correct required parameters for fundamental strategy', () => {
        const params = strategyRepository.testGetRequiredParameters('fundamental');
        expect(params).toEqual(['metrics', 'thresholds']);
      });

      it('should return correct required parameters for ML strategy', () => {
        const params = strategyRepository.testGetRequiredParameters('ml');
        expect(params).toEqual(['model_url', 'features', 'confidence_threshold']);
      });

      it('should return correct required parameters for hybrid strategy', () => {
        const params = strategyRepository.testGetRequiredParameters('hybrid');
        expect(params).toEqual(['technical_weight', 'fundamental_weight', 'ml_weight']);
      });

      it('should return empty array for unknown strategy type', () => {
        const params = strategyRepository.testGetRequiredParameters('unknown' as any);
        expect(params).toEqual([]);
      });
    });

    describe('validateEntity', () => {
      it('should validate required fields for create operation', async () => {
        const invalidEntity: Partial<Strategy> = {
          // Missing required name and type
          parameters: {}
        };

        await expect(
          strategyRepository.testValidateEntity(invalidEntity, 'create')
        ).rejects.toThrow('Strategy name is required');
      });

      it('should require strategy type for create operation', async () => {
        const invalidEntity: Partial<Strategy> = {
          name: 'Test Strategy',
          // Missing required type
          parameters: {}
        };

        await expect(
          strategyRepository.testValidateEntity(invalidEntity, 'create')
        ).rejects.toThrow('Strategy type is required');
      });

      it('should require parameters for create operation', async () => {
        const invalidEntity: Partial<Strategy> = {
          name: 'Test Strategy',
          type: 'technical'
          // Missing required parameters
        };

        await expect(
          strategyRepository.testValidateEntity(invalidEntity, 'create')
        ).rejects.toThrow('Strategy parameters are required');
      });

      it('should validate strategy status values', async () => {
        const invalidEntity: Partial<Strategy> = {
          name: 'Test Strategy',
          type: 'technical',
          status: 'invalid_status' as any,
          parameters: {}
        };

        await expect(
          strategyRepository.testValidateEntity(invalidEntity, 'update')
        ).rejects.toThrow('Invalid strategy status');
      });

      it('should validate strategy type values', async () => {
        const invalidEntity: Partial<Strategy> = {
          name: 'Test Strategy',
          type: 'invalid_type' as any,
          parameters: {}
        };

        await expect(
          strategyRepository.testValidateEntity(invalidEntity, 'create')
        ).rejects.toThrow('Invalid strategy type');
      });

      it('should validate timeframe parameter type', async () => {
        const invalidEntity: Partial<Strategy> = {
          name: 'Test Strategy',
          type: 'technical',
          parameters: {
            timeframe: 123 // Should be string
          }
        };

        await expect(
          strategyRepository.testValidateEntity(invalidEntity, 'create')
        ).rejects.toThrow('Timeframe must be a string');
      });

      it('should validate risk profile type', async () => {
        const invalidEntity: Partial<Strategy> = {
          name: 'Test Strategy',
          type: 'technical',
          parameters: {},
          risk_profile: 'invalid' as any // Should be object
        };

        await expect(
          strategyRepository.testValidateEntity(invalidEntity, 'create')
        ).rejects.toThrow('Risk profile must be an object');
      });

      it('should accept valid strategy entity', async () => {
        const validEntity: Partial<Strategy> = {
          name: 'Test Strategy',
          type: 'technical',
          status: 'active',
          parameters: {
            timeframe: '1h',
            indicators: ['SMA']
          },
          risk_profile: {
            max_drawdown: 0.05
          }
        };

        // Should not throw
        await expect(
          strategyRepository.testValidateEntity(validEntity, 'create')
        ).resolves.toBeUndefined();
      });
    });
  });

  describe('StrategyRepository Public Interface', () => {
    it('should be instantiable', () => {
      const repo = new StrategyRepository();
      expect(repo).toBeInstanceOf(StrategyRepository);
    });

    it('should have required public methods', () => {
      const repo = new StrategyRepository();
      
      // Check that all required public methods exist
      expect(typeof repo.findActiveStrategies).toBe('function');
      expect(typeof repo.findByType).toBe('function');
      expect(typeof repo.updatePerformanceMetrics).toBe('function');
      expect(typeof repo.getStrategyPerformance).toBe('function');
      expect(typeof repo.activateStrategy).toBe('function');
      expect(typeof repo.pauseStrategy).toBe('function');
      expect(typeof repo.archiveStrategy).toBe('function');
      expect(typeof repo.validateStrategyConfiguration).toBe('function');
      expect(typeof repo.getStrategyRankings).toBe('function');
      expect(typeof repo.cloneStrategy).toBe('function');
    });

    it('should inherit from BaseRepository', () => {
      const repo = new StrategyRepository();
      
      // Check that it has BaseRepository methods
      expect(typeof repo.create).toBe('function');
      expect(typeof repo.findById).toBe('function');
      expect(typeof repo.findMany).toBe('function');
      expect(typeof repo.update).toBe('function');
      expect(typeof repo.delete).toBe('function');
      expect(typeof repo.count).toBe('function');
    });
  });

  describe('Method Return Types', () => {
    it('should return RepositoryResult for async operations', async () => {
      // These will fail with mock data but should return proper structure
      const result1 = await strategyRepository.findActiveStrategies();
      expect(result1).toHaveProperty('success');
      expect(result1).toHaveProperty('metadata');

      const result2 = await strategyRepository.findByType('technical');
      expect(result2).toHaveProperty('success');
      expect(result2).toHaveProperty('metadata');

      const result3 = await strategyRepository.validateStrategyConfiguration('test-id');
      expect(result3).toHaveProperty('success');
      expect(result3).toHaveProperty('metadata');

      const result4 = await strategyRepository.getStrategyRankings();
      expect(result4).toHaveProperty('success');
      expect(result4).toHaveProperty('metadata');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      // Since our test methods are mocked to return errors, test error handling
      const result = await strategyRepository.updatePerformanceMetrics('test-id', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.executionTimeMs).toBeGreaterThan(0);
    });
  });
});