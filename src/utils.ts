/**
 * Represents the result of a linear regression calculation,
 * containing both the slope and y-intercept of the fitted line.
 */
type RegressionResult = {
    slope: number;
    intercept: number;
};

/**
 * Performs simple linear regression on a series of numbers to find the line of best fit.
 * Uses the least squares method to minimize the sum of squared residuals.
 * 
 * @param history - Array of numbers representing y-values, where their index positions are x-values
 * @returns RegressionResult containing the slope and y-intercept of the fitted line
 */
function linearRegression(history: number[]): RegressionResult {
    const n = history.length;
    // Handle edge case: if less than 2 points, can't calculate meaningful slope
    if (n < 2) return { slope: 0, intercept: history[0] || 0 };

    // Create x-values array using indices (0, 1, 2, ...)
    const x = Array.from({ length: n }, (_, i) => i);
    const y = history;

    // Initialize variables for sums used in regression formula
    let sumX = 0,    // Sum of x values
        sumY = 0,    // Sum of y values
        sumXY = 0,   // Sum of x*y products
        sumX2 = 0;   // Sum of x squared values

    // Calculate sums needed for regression formula
    for (let i = 0; i < n; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i];
    }

    // Calculate slope
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - (sumX * sumX));

    // Calculate y-intercept using the formula: b = (∑y - m∑x) / n
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}
