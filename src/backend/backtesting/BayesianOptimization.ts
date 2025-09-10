/**
 * BayesianOptimization - Task BE-033: Bayesian Optimization Implementation
 * 
 * Advanced Bayesian optimization framework including:
 * - Gaussian Process regression implementation
 * - Acquisition function optimization (EI, PI, UCB)
 * - Hyperparameter tuning with marginal likelihood
 * - Convergence detection and early stopping
 * - Multi-dimensional parameter space handling
 * - Noise modeling and uncertainty quantification
 */

import { EventEmitter } from 'events';

/**
 * Gaussian Process kernel interface
 */
interface Kernel {
  compute(x1: number[], x2: number[]): number;
  computeGradient?(x1: number[], x2: number[]): number[];
  getHyperparameters(): number[];
  setHyperparameters(params: number[]): void;
}

/**
 * RBF (Radial Basis Function) Kernel
 */
class RBFKernel implements Kernel {
  private lengthScale: number;
  private signalVariance: number;

  constructor(lengthScale: number = 1.0, signalVariance: number = 1.0) {
    this.lengthScale = lengthScale;
    this.signalVariance = signalVariance;
  }

  compute(x1: number[], x2: number[]): number {
    const squaredDistance = x1.reduce((sum, val, i) => {
      return sum + Math.pow(val - x2[i], 2);
    }, 0);
    
    return this.signalVariance * Math.exp(-squaredDistance / (2 * Math.pow(this.lengthScale, 2)));
  }

  computeGradient(x1: number[], x2: number[]): number[] {
    const k = this.compute(x1, x2);
    const squaredDistance = x1.reduce((sum, val, i) => sum + Math.pow(val - x2[i], 2), 0);
    
    // Gradient with respect to length scale
    const dlengthScale = k * squaredDistance / Math.pow(this.lengthScale, 3);
    
    // Gradient with respect to signal variance
    const dsignalVariance = k / this.signalVariance;
    
    return [dlengthScale, dsignalVariance];
  }

  getHyperparameters(): number[] {
    return [this.lengthScale, this.signalVariance];
  }

  setHyperparameters(params: number[]): void {
    this.lengthScale = Math.max(params[0], 1e-6); // Prevent numerical issues
    this.signalVariance = Math.max(params[1], 1e-6);
  }
}

/**
 * Matérn Kernel (ν = 5/2)
 */
class MaternKernel implements Kernel {
  private lengthScale: number;
  private signalVariance: number;

  constructor(lengthScale: number = 1.0, signalVariance: number = 1.0) {
    this.lengthScale = lengthScale;
    this.signalVariance = signalVariance;
  }

  compute(x1: number[], x2: number[]): number {
    const distance = Math.sqrt(x1.reduce((sum, val, i) => {
      return sum + Math.pow(val - x2[i], 2);
    }, 0));
    
    if (distance === 0) return this.signalVariance;
    
    const scaledDistance = Math.sqrt(5) * distance / this.lengthScale;
    const term1 = 1 + scaledDistance + (5 * Math.pow(distance, 2)) / (3 * Math.pow(this.lengthScale, 2));
    const term2 = Math.exp(-scaledDistance);
    
    return this.signalVariance * term1 * term2;
  }

  getHyperparameters(): number[] {
    return [this.lengthScale, this.signalVariance];
  }

  setHyperparameters(params: number[]): void {
    this.lengthScale = Math.max(params[0], 1e-6);
    this.signalVariance = Math.max(params[1], 1e-6);
  }
}

/**
 * Acquisition function interface
 */
interface AcquisitionFunction {
  compute(mean: number, variance: number, fStar: number): number;
  name: string;
}

/**
 * Expected Improvement acquisition function
 */
class ExpectedImprovement implements AcquisitionFunction {
  name = 'Expected Improvement';
  private xi: number; // Exploration parameter

  constructor(xi: number = 0.01) {
    this.xi = xi;
  }

  compute(mean: number, variance: number, fStar: number): number {
    if (variance <= 0) return 0;
    
    const sigma = Math.sqrt(variance);
    const improvement = mean - fStar - this.xi;
    const z = improvement / sigma;
    
    return improvement * this.normalCDF(z) + sigma * this.normalPDF(z);
  }

  private normalPDF(z: number): number {
    return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  }

  private normalCDF(z: number): number {
    return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }
}

/**
 * Probability of Improvement acquisition function
 */
class ProbabilityOfImprovement implements AcquisitionFunction {
  name = 'Probability of Improvement';
  private xi: number;

  constructor(xi: number = 0.01) {
    this.xi = xi;
  }

  compute(mean: number, variance: number, fStar: number): number {
    if (variance <= 0) return 0;
    
    const sigma = Math.sqrt(variance);
    const improvement = mean - fStar - this.xi;
    const z = improvement / sigma;
    
    return this.normalCDF(z);
  }

  private normalCDF(z: number): number {
    return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Same as above
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }
}

/**
 * Upper Confidence Bound acquisition function
 */
class UpperConfidenceBound implements AcquisitionFunction {
  name = 'Upper Confidence Bound';
  private beta: number;

  constructor(beta: number = 2.0) {
    this.beta = beta;
  }

  compute(mean: number, variance: number, fStar: number): number {
    return mean + this.beta * Math.sqrt(Math.max(variance, 0));
  }
}

/**
 * Gaussian Process implementation
 */
class GaussianProcess {
  private kernel: Kernel;
  private noiseVariance: number;
  private X: number[][];         // Training inputs
  private y: number[];           // Training outputs
  private K: number[][];         // Covariance matrix
  private KInv: number[][];      // Inverse covariance matrix
  private alpha: number[];       // K^-1 * y
  private logMarginalLikelihood: number = 0;

  constructor(kernel: Kernel, noiseVariance: number = 1e-6) {
    this.kernel = kernel;
    this.noiseVariance = noiseVariance;
    this.X = [];
    this.y = [];
    this.K = [];
    this.KInv = [];
    this.alpha = [];
  }

  /**
   * Fit the Gaussian Process to training data
   */
  fit(X: number[][], y: number[]): void {
    this.X = X.map(x => [...x]); // Deep copy
    this.y = [...y];

    // Compute covariance matrix
    this.computeCovarianceMatrix();
    
    // Compute inverse and alpha
    this.computeInverseAndAlpha();
    
    // Compute log marginal likelihood
    this.computeLogMarginalLikelihood();
  }

  /**
   * Predict mean and variance for new points
   */
  predict(XTest: number[][]): { means: number[], variances: number[] } {
    const means: number[] = [];
    const variances: number[] = [];

    for (const xTest of XTest) {
      const kStar = this.X.map(x => this.kernel.compute(x, xTest));
      const kStarStar = this.kernel.compute(xTest, xTest) + this.noiseVariance;
      
      // Mean prediction
      const mean = kStar.reduce((sum, k, i) => sum + k * this.alpha[i], 0);
      means.push(mean);
      
      // Variance prediction
      let variance = kStarStar;
      for (let i = 0; i < this.X.length; i++) {
        for (let j = 0; j < this.X.length; j++) {
          variance -= kStar[i] * this.KInv[i][j] * kStar[j];
        }
      }
      variances.push(Math.max(variance, 0)); // Ensure non-negative
    }

    return { means, variances };
  }

  /**
   * Optimize hyperparameters by maximizing marginal likelihood
   */
  optimizeHyperparameters(maxIterations: number = 50): void {
    const initialParams = this.kernel.getHyperparameters();
    let currentParams = [...initialParams];
    let currentLikelihood = this.logMarginalLikelihood;
    
    const learningRate = 0.01;
    const tolerance = 1e-6;
    
    for (let iter = 0; iter < maxIterations; iter++) {
      // Compute gradient (numerical approximation)
      const gradient = this.computeHyperparameterGradient(currentParams);
      
      // Update parameters
      const newParams = currentParams.map((p, i) => p + learningRate * gradient[i]);
      
      // Set new parameters and refit
      this.kernel.setHyperparameters(newParams);
      this.computeCovarianceMatrix();
      this.computeInverseAndAlpha();
      this.computeLogMarginalLikelihood();
      
      // Check convergence
      if (Math.abs(this.logMarginalLikelihood - currentLikelihood) < tolerance) {
        break;
      }
      
      if (this.logMarginalLikelihood > currentLikelihood) {
        currentParams = newParams;
        currentLikelihood = this.logMarginalLikelihood;
      } else {
        // Revert if likelihood decreased
        this.kernel.setHyperparameters(currentParams);
        this.computeCovarianceMatrix();
        this.computeInverseAndAlpha();
        this.computeLogMarginalLikelihood();
      }
    }
  }

  /**
   * Get current log marginal likelihood
   */
  getLogMarginalLikelihood(): number {
    return this.logMarginalLikelihood;
  }

  private computeCovarianceMatrix(): void {
    const n = this.X.length;
    this.K = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        this.K[i][j] = this.kernel.compute(this.X[i], this.X[j]);
        if (i === j) {
          this.K[i][j] += this.noiseVariance; // Add noise to diagonal
        }
      }
    }
  }

  private computeInverseAndAlpha(): void {
    // Compute inverse using Cholesky decomposition for numerical stability
    const L = this.choleskyDecomposition(this.K);
    this.KInv = this.choleskyInverse(L);
    
    // Compute alpha = K^-1 * y
    this.alpha = this.matrixVectorMultiply(this.KInv, this.y);
  }

  private choleskyDecomposition(matrix: number[][]): number[][] {
    const n = matrix.length;
    const L = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        if (i === j) {
          let sum = 0;
          for (let k = 0; k < j; k++) {
            sum += L[j][k] * L[j][k];
          }
          L[j][j] = Math.sqrt(Math.max(matrix[j][j] - sum, 1e-10));
        } else {
          let sum = 0;
          for (let k = 0; k < j; k++) {
            sum += L[i][k] * L[j][k];
          }
          L[i][j] = (matrix[i][j] - sum) / L[j][j];
        }
      }
    }
    
    return L;
  }

  private choleskyInverse(L: number[][]): number[][] {
    const n = L.length;
    const inv = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Forward substitution for L^-1
    for (let i = 0; i < n; i++) {
      inv[i][i] = 1 / L[i][i];
      for (let j = 0; j < i; j++) {
        let sum = 0;
        for (let k = j; k < i; k++) {
          sum += L[i][k] * inv[k][j];
        }
        inv[i][j] = -sum / L[i][i];
      }
    }
    
    // Compute (L^T)^-1 * L^-1
    const result = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = Math.max(i, j); k < n; k++) {
          result[i][j] += inv[k][i] * inv[k][j];
        }
      }
    }
    
    return result;
  }

  private matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => 
      row.reduce((sum, val, i) => sum + val * vector[i], 0)
    );
  }

  private computeLogMarginalLikelihood(): void {
    const n = this.y.length;
    if (n === 0) {
      this.logMarginalLikelihood = 0;
      return;
    }
    
    // Log likelihood = -0.5 * y^T * K^-1 * y - 0.5 * log|K| - n/2 * log(2π)
    const yTKInvy = this.y.reduce((sum, yi, i) => sum + yi * this.alpha[i], 0);
    
    // Log determinant via Cholesky decomposition
    const L = this.choleskyDecomposition(this.K);
    let logDet = 0;
    for (let i = 0; i < n; i++) {
      logDet += 2 * Math.log(Math.max(L[i][i], 1e-10));
    }
    
    this.logMarginalLikelihood = -0.5 * yTKInvy - 0.5 * logDet - 0.5 * n * Math.log(2 * Math.PI);
  }

  private computeHyperparameterGradient(params: number[]): number[] {
    const epsilon = 1e-6;
    const gradient: number[] = [];
    
    for (let i = 0; i < params.length; i++) {
      // Forward difference
      const paramsPlus = [...params];
      paramsPlus[i] += epsilon;
      
      this.kernel.setHyperparameters(paramsPlus);
      this.computeCovarianceMatrix();
      this.computeInverseAndAlpha();
      this.computeLogMarginalLikelihood();
      const likelihoodPlus = this.logMarginalLikelihood;
      
      // Restore original parameters
      this.kernel.setHyperparameters(params);
      this.computeCovarianceMatrix();
      this.computeInverseAndAlpha();
      this.computeLogMarginalLikelihood();
      const likelihoodOriginal = this.logMarginalLikelihood;
      
      gradient[i] = (likelihoodPlus - likelihoodOriginal) / epsilon;
    }
    
    return gradient;
  }
}

/**
 * Main Bayesian Optimization class
 */
export class BayesianOptimization extends EventEmitter {
  private gp: GaussianProcess;
  private acquisitionFunction: AcquisitionFunction;
  private bounds: Array<[number, number]>;
  private X: number[][];
  private y: number[];
  private bestX: number[] | null = null;
  private bestY: number = -Infinity;

  constructor(
    bounds: Array<[number, number]>,
    kernelType: 'rbf' | 'matern' = 'rbf',
    acquisitionType: 'ei' | 'pi' | 'ucb' = 'ei',
    noiseVariance: number = 1e-6
  ) {
    super();
    
    this.bounds = bounds;
    this.X = [];
    this.y = [];
    
    // Initialize kernel
    let kernel: Kernel;
    switch (kernelType) {
      case 'rbf':
        kernel = new RBFKernel(1.0, 1.0);
        break;
      case 'matern':
        kernel = new MaternKernel(1.0, 1.0);
        break;
      default:
        throw new Error(`Unknown kernel type: ${kernelType}`);
    }
    
    this.gp = new GaussianProcess(kernel, noiseVariance);
    
    // Initialize acquisition function
    switch (acquisitionType) {
      case 'ei':
        this.acquisitionFunction = new ExpectedImprovement(0.01);
        break;
      case 'pi':
        this.acquisitionFunction = new ProbabilityOfImprovement(0.01);
        break;
      case 'ucb':
        this.acquisitionFunction = new UpperConfidenceBound(2.0);
        break;
      default:
        throw new Error(`Unknown acquisition function: ${acquisitionType}`);
    }
  }

  /**
   * Add observation to the Gaussian Process
   */
  addObservation(x: number[], y: number): void {
    this.X.push([...x]);
    this.y.push(y);
    
    // Update best observation
    if (y > this.bestY) {
      this.bestY = y;
      this.bestX = [...x];
    }
    
    this.emit('observation_added', { x, y, bestY: this.bestY });
  }

  /**
   * Suggest next point to evaluate
   */
  suggest(): number[] {
    if (this.X.length === 0) {
      // First point: random sample
      return this.bounds.map(([min, max]) => Math.random() * (max - min) + min);
    }
    
    // Fit Gaussian Process
    this.gp.fit(this.X, this.y);
    
    // Optimize hyperparameters periodically
    if (this.X.length % 10 === 0) {
      this.emit('optimizing_hyperparameters');
      this.gp.optimizeHyperparameters();
    }
    
    // Optimize acquisition function
    const nextX = this.optimizeAcquisitionFunction();
    
    this.emit('suggestion', { x: nextX });
    return nextX;
  }

  /**
   * Get current best observation
   */
  getBest(): { x: number[], y: number } | null {
    if (this.bestX === null) return null;
    return { x: [...this.bestX], y: this.bestY };
  }

  /**
   * Get posterior mean and variance at test points
   */
  getPosterior(XTest: number[][]): { means: number[], variances: number[] } {
    if (this.X.length === 0) {
      return {
        means: XTest.map(() => 0),
        variances: XTest.map(() => 1)
      };
    }
    
    this.gp.fit(this.X, this.y);
    return this.gp.predict(XTest);
  }

  /**
   * Check convergence based on acquisition function values
   */
  checkConvergence(threshold: number = 1e-6): boolean {
    if (this.X.length < 10) return false;
    
    // Generate test points and compute acquisition function values
    const testPoints = this.generateTestPoints(100);
    const { means, variances } = this.gp.predict(testPoints);
    
    const acquisitionValues = means.map((mean, i) => 
      this.acquisitionFunction.compute(mean, variances[i], this.bestY)
    );
    
    const maxAcquisition = Math.max(...acquisitionValues);
    
    this.emit('convergence_check', { maxAcquisition, threshold });
    
    return maxAcquisition < threshold;
  }

  private optimizeAcquisitionFunction(): number[] {
    // Simple grid search for acquisition function optimization
    // In production, would use more sophisticated optimization
    const gridSize = 100;
    const testPoints = this.generateTestPoints(gridSize);
    
    const { means, variances } = this.gp.predict(testPoints);
    
    let bestX = testPoints[0];
    let bestAcquisition = -Infinity;
    
    for (let i = 0; i < testPoints.length; i++) {
      const acquisition = this.acquisitionFunction.compute(means[i], variances[i], this.bestY);
      
      if (acquisition > bestAcquisition) {
        bestAcquisition = acquisition;
        bestX = testPoints[i];
      }
    }
    
    return bestX;
  }

  private generateTestPoints(n: number): number[][] {
    const points: number[][] = [];
    
    for (let i = 0; i < n; i++) {
      const point = this.bounds.map(([min, max]) => Math.random() * (max - min) + min);
      points.push(point);
    }
    
    return points;
  }
}

export type {
  Kernel,
  AcquisitionFunction
};

export {
  RBFKernel,
  MaternKernel,
  ExpectedImprovement,
  ProbabilityOfImprovement,
  UpperConfidenceBound,
  GaussianProcess
};