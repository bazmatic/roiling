export class Grid {
  private width: number;
  private height: number;
  private buffer: Float32Array;
  private historyBuffer: Float32Array[];
  private historyIndex: number;
  private cellHistory: number[][];
  
  private readonly MAX_CELL_HISTORY = 100;

  constructor(width: number = 100, height: number = 100, frameHistory: number = 5) {
    this.width = width;
    this.height = height;
    this.buffer = new Float32Array(width * height);
    this.historyBuffer = Array(frameHistory)
      .fill(null)
      .map(() => new Float32Array(width * height).fill(0));
    this.historyIndex = 0;
    this.cellHistory = Array(width * height).fill(null).map(() => []);
  }

  private getWrappedValue(buffer: Float32Array, x: number, y: number): number {
    const wrappedX = (x + this.width) % this.width;
    const wrappedY = (y + this.height) % this.height;
    return buffer[wrappedY * this.width + wrappedX];
  }

  private getSmoothNeighborhood(buffer: Float32Array, x: number, y: number, spatialSmoothing: number): number {
    const values = [
      this.getWrappedValue(buffer, x-1, y-1),
      this.getWrappedValue(buffer, x, y-1),
      this.getWrappedValue(buffer, x+1, y-1),
      this.getWrappedValue(buffer, x-1, y),
      this.getWrappedValue(buffer, x, y),
      this.getWrappedValue(buffer, x+1, y),
      this.getWrappedValue(buffer, x-1, y+1),
      this.getWrappedValue(buffer, x, y+1),
      this.getWrappedValue(buffer, x+1, y+1)
    ];
    
    const neighborWeight = spatialSmoothing / 8;
    const centerWeight = 1 - spatialSmoothing;
    
    return values[4] * centerWeight + 
           (values[0] + values[1] + values[2] + 
            values[3] + values[5] + 
            values[6] + values[7] + values[8]) * neighborWeight;
  }

  private predictNextValue(index: number): number {
    const history = this.cellHistory[index];
    if (history.length < 2) return history[history.length - 1] || 0;
    
    const { slope, intercept } = this.linearRegression(history);
    return slope * history.length + intercept;
  }

  private linearRegression(values: number[]): { slope: number; intercept: number } {
    const n = values.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  public update(params: {
    randomValues: number,
    spatialSmoothing: number,
    temporalSmoothing: number,
    frameHistory: number,
    regressionWeight: number
  }): Float32Array {
    const { randomValues, spatialSmoothing, temporalSmoothing, frameHistory, regressionWeight } = params;
    const tempBuffer = new Float32Array(this.width * this.height);
    const spatialBuffer = new Float32Array(this.width * this.height);

    // Generate new random values
    for (let i = 0; i < this.width * this.height; i++) {
      let sum = 0;
      for (let j = 0; j < randomValues; j++) {
        sum += Math.random();
      }
      tempBuffer[i] = sum / randomValues;
    }

    // Apply spatial smoothing
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const index = y * this.width + x;
        spatialBuffer[index] = this.getSmoothNeighborhood(tempBuffer, x, y, spatialSmoothing);
      }
    }

    // Blend with history and predictions
    const result = new Float32Array(this.width * this.height);
    const historyWeight = temporalSmoothing / frameHistory;
    const currentWeight = 1 - temporalSmoothing;

    for (let i = 0; i < this.width * this.height; i++) {
      // Update cell history
      this.cellHistory[i].push(spatialBuffer[i]);
      if (this.cellHistory[i].length > this.MAX_CELL_HISTORY) {
        this.cellHistory[i].shift();
      }

      // Predict next value using regression
      const predicted = this.predictNextValue(i);

      // Calculate weighted contributions
      const currentContribution = spatialBuffer[i] * (1 - regressionWeight);
      const predictionContribution = predicted * regressionWeight;

      // Combine current value with regression prediction
      const blendedCurrent = currentContribution + predictionContribution;

      // Blend with temporal history
      result[i] = blendedCurrent * currentWeight;
      for (let f = 0; f < frameHistory; f++) {
        result[i] += this.historyBuffer[f][i] * historyWeight;
      }
    }

    // Update history buffer
    this.historyBuffer[this.historyIndex].set(result);
    this.historyIndex = (this.historyIndex + 1) % frameHistory;

    this.buffer = result;

    return result;
  }

  public reset(frameHistory: number): void {
    this.historyBuffer = Array(frameHistory)
      .fill(null)
      .map(() => new Float32Array(this.width * this.height).fill(0));
    this.historyIndex = 0;
    this.cellHistory = Array(this.width * this.height).fill(null).map(() => []);
  }

  public get size(): number {
    return this.width * this.height;
  }

  public get dimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  // Uint8ClampedArray is a type of image data that can be used to draw on a canvas
  // It's specialised to handle the RGBA format efficiently
  public getImageData(contrast: number, normalise: boolean): Uint8ClampedArray {
    const data = new Uint8ClampedArray(this.size * 4);
    const gridValues = this.buffer;

    // Add this debug log
    // if (Math.random() < 0.01) { // Only log 1% of the time to avoid console spam
    //     console.log('Buffer values:', 
    //         'min:', Math.min(...gridValues), 
    //         'max:', Math.max(...gridValues),
    //         'avg:', gridValues.reduce((a,b) => a+b, 0) / gridValues.length
    //     );
    // }

    // Apply contrast and find min/max if normalising
    let minValue = normalise ? Infinity : 0;
    let maxValue = normalise ? -Infinity : 1;
    
    if (normalise) {
        for (let i = 0; i < this.size; i++) {
            let value = gridValues[i];
            value = value - 0.5;
            value = value * Math.exp(contrast);
            value = value + 0.5;
            minValue = Math.min(minValue, value);
            maxValue = Math.max(maxValue, value);
        }
    }

    // Now apply contrast and optional normalization before color mapping
    const range = maxValue - minValue;
    for (let i = 0; i < this.size; i++) {
        let value = gridValues[i];
        value = value - 0.5;
        value = value * Math.exp(contrast);
        value = value + 0.5;
        
        if (normalise) {
            value = (value - minValue) / range;
        } else {
            value = Math.max(0, Math.min(1, value));
        }

        this.valueToColorData(value, data, i * 4);
    }

    return data;
  }

  private valueToColorData(value: number, data: Uint8ClampedArray, pixelIndex: number): void {
    // Color interpolation, ranging from black through red, orange, yellow to white
    // Like fire or the sun's surface ;-)
    if (value < 0.25) {
        // Black to Red (0.0 - 0.25)
        const t = value / 0.25;
        data[pixelIndex] = t * 255;     // R
        data[pixelIndex + 1] = 0;       // G
        data[pixelIndex + 2] = 0;       // B
    } else if (value < 0.5) {
        // Red to Orange (0.25 - 0.5)
        const t = (value - 0.25) / 0.25;
        data[pixelIndex] = 255;         // R
        data[pixelIndex + 1] = t * 165; // G (orange has G=165)
        data[pixelIndex + 2] = 0;       // B
    } else if (value < 0.75) {
        // Orange to Yellow (0.5 - 0.75)
        const t = (value - 0.5) / 0.25;
        data[pixelIndex] = 255;         // R
        data[pixelIndex + 1] = 165 + (t * (255-165)); // G (from 165 to 255)
        data[pixelIndex + 2] = 0;       // B
    } else {
        // Yellow to White (0.75 - 1.0)
        const t = (value - 0.75) / 0.25;
        data[pixelIndex] = 255;         // R
        data[pixelIndex + 1] = 255;     // G
        data[pixelIndex + 2] = t * 255; // B
    }
    data[pixelIndex + 3] = 255; // A
  }
} 