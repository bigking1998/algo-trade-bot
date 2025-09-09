
          import { BaseStrategy } from '../BaseStrategy.js';
          
          export class ConcurrentStrategy4 extends BaseStrategy {
            async generateSignal() {
              return Math.random() > 0.5 ? 'BUY' : 'SELL';
            }
          }
        