
        import { BaseStrategy } from '../BaseStrategy.js';
        
        export class ProblematicStrategy extends BaseStrategy {
          async generateSignal() {
            // Simulate memory leak or infinite loop potential
            const largeArray = new Array(1000000).fill(0);
            
            // Simulate network error
            throw new Error('ECONNRESET: Connection reset by peer');
          }
        }
      