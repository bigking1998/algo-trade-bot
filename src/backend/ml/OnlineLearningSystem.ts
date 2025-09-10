/**
 * Online Learning System - Task ML-007
 * 
 * Incremental model updates, concept drift detection, and adaptive learning rates.
 */

import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';

export interface OnlineLearningConfig {
  learningRate: number;
  adaptiveLearningRate: boolean;
  driftDetectionWindow: number;
  driftThreshold: number;
  updateFrequency: number; // minutes
}

export interface ConceptDriftMetrics {
  detected: boolean;
  severity: number;
  confidence: number;
  timestamp: number;
}

export class OnlineLearningSystem extends EventEmitter {
  private config: OnlineLearningConfig;
  private performanceHistory: number[] = [];
  private lastUpdate = 0;
  private currentLearningRate: number;

  constructor(config: OnlineLearningConfig) {
    super();
    this.config = config;
    this.currentLearningRate = config.learningRate;
  }

  async updateModelOnline(
    model: tf.LayersModel,
    newFeatures: Float32Array,
    newLabel: number
  ): Promise<tf.LayersModel> {
    const features = tf.tensor2d([Array.from(newFeatures)]);
    const labels = tf.tensor2d([[newLabel]]);

    // Perform incremental update
    const optimizer = tf.train.adam(this.currentLearningRate);
    
    model.compile({
      optimizer,
      loss: 'meanSquaredError'
    });

    // Single batch update
    await model.fit(features, labels, {
      epochs: 1,
      batchSize: 1,
      verbose: 0
    });

    // Cleanup
    features.dispose();
    labels.dispose();

    // Adjust learning rate if adaptive
    if (this.config.adaptiveLearningRate) {
      this.adjustLearningRate();
    }

    this.emit('modelUpdated', { learningRate: this.currentLearningRate });
    return model;
  }

  detectConceptDrift(
    currentPerformance: number,
    referencePerformance: number
  ): ConceptDriftMetrics {
    this.performanceHistory.push(currentPerformance);
    
    if (this.performanceHistory.length > this.config.driftDetectionWindow) {
      this.performanceHistory.shift();
    }

    const avgPerformance = this.performanceHistory.reduce((a, b) => a + b, 0) / this.performanceHistory.length;
    const performanceDrop = referencePerformance - avgPerformance;
    
    const detected = performanceDrop > this.config.driftThreshold;
    const severity = Math.min(1, performanceDrop / this.config.driftThreshold);
    const confidence = this.performanceHistory.length / this.config.driftDetectionWindow;

    const metrics: ConceptDriftMetrics = {
      detected,
      severity,
      confidence,
      timestamp: Date.now()
    };

    if (detected) {
      console.log(`🚨 Concept drift detected! Severity: ${severity.toFixed(3)}`);
      this.emit('conceptDriftDetected', metrics);
    }

    return metrics;
  }

  private adjustLearningRate(): void {
    // Simple adaptive learning rate adjustment
    const recentPerformance = this.performanceHistory.slice(-5);
    if (recentPerformance.length >= 5) {
      const isImproving = recentPerformance[4] > recentPerformance[0];
      
      if (isImproving) {
        this.currentLearningRate = Math.min(this.config.learningRate * 2, this.config.learningRate * 1.1);
      } else {
        this.currentLearningRate = Math.max(this.config.learningRate / 2, this.config.learningRate * 0.9);
      }
    }
  }

  shouldUpdateModel(): boolean {
    return (Date.now() - this.lastUpdate) > (this.config.updateFrequency * 60 * 1000);
  }

  reset(): void {
    this.performanceHistory = [];
    this.currentLearningRate = this.config.learningRate;
    this.lastUpdate = 0;
    console.log('🔄 Online learning system reset');
  }
}