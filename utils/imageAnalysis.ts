import * as tf from "@tensorflow/tfjs"
import { decodeJpeg } from "@tensorflow/tfjs-react-native"
import { Platform } from "react-native"
require("@tensorflow/tfjs-react-native")

export interface SingleImageAnalysis {
  meanPixelIntensity: number
  variance: number
  standardDeviation: number
  edgeIntensity: number
  contrast: number
  muscleDefinitionScore: number
  lightingQuality: {
    quality: string
    brightness: number
    evenness: number
  }
  imageQuality: {
    quality: string
    score: number
  }
}

export interface ComparisonAnalysis {
  totalChange: number
  maxChange: number
  similarity: number
  progressScore: number
  changePercentage: number
  regionAnalysis: {
    upper: { score: number; change: number }
    middle: { score: number; change: number }
    lower: { score: number; change: number }
  }
  recommendations: string[]
}

export class ImageAnalysis {
  private isInitialized = false
  private model: tf.GraphModel | null = null

  /**
   * Initialize TensorFlow.js for React Native
   */
  async initialize(): Promise<void> {
    try {
      console.log("Initializing TensorFlow.js for React Native...")

      // Wait for TensorFlow to be ready
      await tf.ready()

      let backendSet = false

      if (Platform.OS === "ios" || Platform.OS === "android") {
        try {
          // Try GPU backend first for better performance
          await tf.setBackend("rn-webgl")
          backendSet = true
          console.log("TensorFlow.js initialized with rn-webgl backend")
        } catch (error) {
          console.log("rn-webgl backend not available, trying cpu...")
        }
      }

      if (!backendSet) {
        try {
          await tf.setBackend("cpu")
          backendSet = true
          console.log("TensorFlow.js initialized with CPU backend")
        } catch (error) {
          console.error("Failed to set CPU backend:", error)
        }
      }

      if (!backendSet) {
        throw new Error("No suitable TensorFlow.js backend available")
      }

      console.log("TensorFlow.js initialized with backend:", tf.getBackend())
      this.isInitialized = true
    } catch (error) {
      console.error("Failed to initialize TensorFlow.js:", error)
      throw error
    }
  }

  /**
   * Convert image URI to tensor for React Native
   */
  private async imageToTensor(imageUri: string): Promise<tf.Tensor4D> {
    try {
      // Load image data from file/uri
      const response = await fetch(imageUri)
      const imageData = await response.arrayBuffer()
      // Decode JPEG to tensor using tfjs-react-native
      const imageTensor = decodeJpeg(new Uint8Array(imageData))
      // Resize to standard size for analysis
      const resized = tf.image.resizeBilinear(imageTensor, [224, 224])
      // Normalize to 0-1 range
      const normalized = resized.cast("float32").div(255.0)
      // Add batch dimension
      const batched = normalized.expandDims(0) as tf.Tensor4D
      // Clean up intermediate tensors
      imageTensor.dispose()
      resized.dispose()
      normalized.dispose()
      return batched
    } catch (error) {
      console.error("Failed to convert image to tensor:", error)
      throw new Error("Failed to process image for analysis")
    }
  }

  /**
   * Analyze single image for fitness metrics
   */
  async analyzeSingleImage(imageUri: string): Promise<SingleImageAnalysis> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const tensor = await this.imageToTensor(imageUri)

      // Calculate basic image statistics
      const mean = tensor.mean().dataSync()[0]
      // Broadcast mean to tensor shape for subtraction
      const meanTensor = tf.fill(tensor.shape, mean)
      const squaredDiff = tf.square(tf.sub(tensor, meanTensor))
      const variance = squaredDiff.mean().dataSync()[0]
      const std = Math.sqrt(variance)
      squaredDiff.dispose()
      meanTensor.dispose()

      // Calculate edge detection for muscle definition proxy
      const edges = this.detectEdges(tensor)
      const edgeIntensity = edges.mean().dataSync()[0]

      // Calculate contrast for overall definition
      const contrast = this.calculateContrast(tensor)

      // Dispose tensors to free memory
      tensor.dispose()
      edges.dispose()

      return {
        meanPixelIntensity: Number.parseFloat(mean.toFixed(3)),
        variance: Number.parseFloat(variance.toFixed(3)),
        standardDeviation: Number.parseFloat(std.toFixed(3)),
        edgeIntensity: Number.parseFloat(edgeIntensity.toFixed(3)),
        contrast: Number.parseFloat(contrast.toFixed(3)),
        muscleDefinitionScore: this.calculateMuscleDefinitionScore(edgeIntensity, contrast, std),
        lightingQuality: this.assessLightingQuality(mean, std),
        imageQuality: this.assessImageQuality(variance, edgeIntensity),
      }
    } catch (error) {
      console.error("Single image analysis failed:", error)
      throw error
    }
  }

  /**
   * Compare two images for progress analysis
   */
  async compareImages(beforeImageUri: string, afterImageUri: string): Promise<ComparisonAnalysis> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const [beforeTensor, afterTensor] = await Promise.all([
        this.imageToTensor(beforeImageUri),
        this.imageToTensor(afterImageUri),
      ])

      // Calculate difference between images
      const diff = tf.sub(afterTensor, beforeTensor)
      const absDiff = tf.abs(diff)

      // Calculate change metrics
      const totalChange = absDiff.mean().dataSync()[0]
      const maxChange = absDiff.max().dataSync()[0]

      // Calculate structural similarity
      const similarity = this.calculateSimilarity(beforeTensor, afterTensor)

      // Analyze specific regions
      const regionAnalysis = this.analyzeRegions(beforeTensor, afterTensor)

      // Calculate progress metrics
      const progressScore = this.calculateProgressScore(totalChange, similarity, regionAnalysis)

      // Dispose tensors
      beforeTensor.dispose()
      afterTensor.dispose()
      diff.dispose()
      absDiff.dispose()

      return {
        totalChange: Number.parseFloat(totalChange.toFixed(3)),
        maxChange: Number.parseFloat(maxChange.toFixed(3)),
        similarity: Number.parseFloat(similarity.toFixed(3)),
        progressScore: Number.parseFloat(progressScore.toFixed(1)),
        changePercentage: Number.parseFloat((totalChange * 100).toFixed(2)),
        regionAnalysis,
        recommendations: this.generateRecommendations(progressScore, regionAnalysis),
      }
    } catch (error) {
      console.error("Image comparison failed:", error)
      throw error
    }
  }

  /**
   * Compare multiple photos for comprehensive progress analysis
   */
  async compareMultiplePhotos(photoUrls: string[]): Promise<{
    overallProgress: number
    timelineAnalysis: any[]
    trends: string[]
  }> {
    if (photoUrls.length < 2) {
      throw new Error("At least 2 photos required for comparison")
    }

    const analyses = await Promise.all(photoUrls.map((url) => this.analyzeSingleImage(url)))

    const timelineAnalysis = []
    let overallProgress = 0

    for (let i = 1; i < analyses.length; i++) {
      const comparison = await this.compareImages(photoUrls[i - 1], photoUrls[i])
      timelineAnalysis.push({
        photoIndex: i,
        comparison,
        timestamp: Date.now() - (analyses.length - i) * 7 * 24 * 60 * 60 * 1000, // Simulate weekly intervals
      })
      overallProgress += comparison.progressScore
    }

    overallProgress = overallProgress / (analyses.length - 1)

    const trends = this.analyzeTrends(timelineAnalysis)

    return {
      overallProgress,
      timelineAnalysis,
      trends,
    }
  }

  /**
   * Edge detection using Sobel filter
   */
  private detectEdges(tensor: tf.Tensor4D): tf.Tensor {
    // Convert to grayscale
    const grayscale = tensor.mean(-1, true)

    // Create Sobel kernels
    const sobelX = tf
      .tensor2d([
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1],
      ])
      .expandDims(-1)
      .expandDims(-1)
    const sobelY = tf
      .tensor2d([
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1],
      ])
      .expandDims(-1)
      .expandDims(-1)

    // Apply convolution
    const edgesX = tf.conv2d(grayscale, sobelX, 1, "same")
    const edgesY = tf.conv2d(grayscale, sobelY, 1, "same")

    // Combine edges
    const edges = tf.sqrt(tf.add(tf.square(edgesX), tf.square(edgesY)))

    // Clean up
    grayscale.dispose()
    sobelX.dispose()
    sobelY.dispose()
    edgesX.dispose()
    edgesY.dispose()

    return edges
  }

  /**
   * Calculate image contrast
   */
  private calculateContrast(tensor: tf.Tensor4D): number {
    const mean = tensor.mean().dataSync()[0]
    const meanTensor = tf.fill(tensor.shape, mean)
    const squaredDiff = tf.square(tf.sub(tensor, meanTensor))
    const variance = squaredDiff.mean().dataSync()[0]
    const contrast = Math.sqrt(variance)
    meanTensor.dispose()
    squaredDiff.dispose()
    return contrast
  }

  /**
   * Calculate muscle definition score
   */
  private calculateMuscleDefinitionScore(edgeIntensity: number, contrast: number, std: number): number {
    // Combine metrics for muscle definition score (0-100)
    const edgeScore = Math.min(edgeIntensity * 1000, 100)
    const contrastScore = Math.min(contrast * 400, 100)
    const varianceScore = Math.min(std * 400, 100)

    return (edgeScore + contrastScore + varianceScore) / 3
  }

  /**
   * Assess lighting quality
   */
  private assessLightingQuality(mean: number, std: number): { quality: string; brightness: number; evenness: number } {
    const brightness = mean
    const evenness = 1 - std // Lower std means more even lighting

    let quality = "Poor"
    if (brightness > 0.3 && brightness < 0.7 && evenness > 0.3) {
      quality = "Excellent"
    } else if (brightness > 0.2 && brightness < 0.8 && evenness > 0.2) {
      quality = "Good"
    } else if (brightness > 0.1 && brightness < 0.9) {
      quality = "Fair"
    }

    return {
      quality,
      brightness: Number.parseFloat(brightness.toFixed(3)),
      evenness: Number.parseFloat(evenness.toFixed(3)),
    }
  }

  /**
   * Assess overall image quality
   */
  private assessImageQuality(variance: number, edgeIntensity: number): { quality: string; score: number } {
    let score = 0

    // Higher variance generally means more detail
    if (variance > 0.05) score += 30
    else if (variance > 0.02) score += 20
    else score += 10

    // Edge intensity indicates sharpness
    if (edgeIntensity > 0.1) score += 40
    else if (edgeIntensity > 0.05) score += 25
    else score += 10

    // Add base score
    score += 30

    let quality = "Poor"
    if (score >= 80) quality = "Excellent"
    else if (score >= 60) quality = "Good"
    else if (score >= 40) quality = "Fair"

    return {
      quality,
      score: Math.min(score, 100),
    }
  }

  /**
   * Calculate similarity between two tensors
   */
  private calculateSimilarity(tensor1: tf.Tensor4D, tensor2: tf.Tensor4D): number {
    const diff = tf.sub(tensor1, tensor2)
    const squaredDiff = tf.square(diff)
    const mse = squaredDiff.mean()

    // Convert MSE to similarity score (0-1, where 1 is identical)
    const similarity = tf.exp(tf.neg(mse.mul(10)))

    const result = similarity.dataSync()[0]

    diff.dispose()
    squaredDiff.dispose()
    mse.dispose()
    similarity.dispose()

    return result
  }

  /**
   * Analyze different regions of the image
   */
  private analyzeRegions(beforeTensor: tf.Tensor4D, afterTensor: tf.Tensor4D) {
    const regions = {
      upper: { score: 0, change: 0 },
      middle: { score: 0, change: 0 },
      lower: { score: 0, change: 0 },
    }

    try {
      const height = beforeTensor.shape[1]
      const regionHeight = Math.floor(height / 3)

      // Analyze upper region (shoulders, chest, arms)
      const beforeUpper = beforeTensor.slice([0, 0, 0, 0], [-1, regionHeight, -1, -1])
      const afterUpper = afterTensor.slice([0, 0, 0, 0], [-1, regionHeight, -1, -1])
      const upperDiff = tf.sub(afterUpper, beforeUpper).abs().mean().dataSync()[0]
      regions.upper.change = Number.parseFloat((upperDiff * 100).toFixed(2))
      regions.upper.score = this.interpretRegionChange(upperDiff)

      // Analyze middle region (core, waist)
      const beforeMiddle = beforeTensor.slice([0, regionHeight, 0, 0], [-1, regionHeight, -1, -1])
      const afterMiddle = afterTensor.slice([0, regionHeight, 0, 0], [-1, regionHeight, -1, -1])
      const middleDiff = tf.sub(afterMiddle, beforeMiddle).abs().mean().dataSync()[0]
      regions.middle.change = Number.parseFloat((middleDiff * 100).toFixed(2))
      regions.middle.score = this.interpretRegionChange(middleDiff)

      // Analyze lower region (legs, glutes)
      const beforeLower = beforeTensor.slice([0, regionHeight * 2, 0, 0], [-1, -1, -1, -1])
      const afterLower = afterTensor.slice([0, regionHeight * 2, 0, 0], [-1, -1, -1, -1])
      const lowerDiff = tf.sub(afterLower, beforeLower).abs().mean().dataSync()[0]
      regions.lower.change = Number.parseFloat((lowerDiff * 100).toFixed(2))
      regions.lower.score = this.interpretRegionChange(lowerDiff)

      // Clean up tensors
      ;[beforeUpper, afterUpper, beforeMiddle, afterMiddle, beforeLower, afterLower].forEach((t) => t.dispose())
    } catch (error) {
      console.error("Region analysis failed:", error)
    }

    return regions
  }

  /**
   * Interpret region change score
   */
  private interpretRegionChange(change: number): number {
    if (change > 0.15) return 85 // Significant positive change
    if (change > 0.1) return 70 // Good change
    if (change > 0.05) return 55 // Moderate change
    if (change > 0.02) return 40 // Slight change
    return 25 // Minimal change
  }

  /**
   * Calculate overall progress score
   */
  private calculateProgressScore(totalChange: number, similarity: number, regionAnalysis: any): number {
    const changeScore = Math.min(totalChange * 500, 40) // Max 40 points for change
    const consistencyScore = similarity * 20 // Max 20 points for consistency
    const regionScore =
      ((regionAnalysis.upper.score + regionAnalysis.middle.score + regionAnalysis.lower.score) / 3) * 0.4 // Max 40 points for regions

    return Math.min(changeScore + consistencyScore + regionScore, 100)
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(progressScore: number, regionAnalysis: any): string[] {
    const recommendations: string[] = []

    if (progressScore < 30) {
      recommendations.push("Progress is slow. Consider adjusting your workout routine and nutrition plan.")
      recommendations.push("Ensure consistent lighting and pose in your photos for better analysis.")
    } else if (progressScore < 60) {
      recommendations.push("Good progress! Keep up the consistency in your training.")
      recommendations.push("Consider tracking measurements alongside photos for comprehensive progress monitoring.")
    } else {
      recommendations.push("Excellent progress! Your hard work is paying off.")
      recommendations.push("Maintain your current routine and consider progressive overload in your workouts.")
    }

    // Region-specific recommendations
    const regions = Object.entries(regionAnalysis)
    const weakestRegion = regions.reduce((min, current) => (current[1].score < min[1].score ? current : min))

    if (weakestRegion[1].score < 50) {
      const regionName = weakestRegion[0]
      if (regionName === "upper") {
        recommendations.push("Focus more on upper body exercises: push-ups, pull-ups, and shoulder workouts.")
      } else if (regionName === "middle") {
        recommendations.push("Strengthen your core with planks, crunches, and rotational exercises.")
      } else if (regionName === "lower") {
        recommendations.push("Add more lower body exercises: squats, lunges, and deadlifts.")
      }
    }

    return recommendations
  }

  /**
   * Analyze trends for long-term progress tracking
   */
  private analyzeTrends(timelineAnalysis: any[]): string[] {
    const trends: string[] = []

    if (timelineAnalysis.length >= 3) {
      const recentScores = timelineAnalysis.slice(-3).map((t) => t.comparison.progressScore)
      const avgRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length

      if (avgRecent > 70) {
        trends.push("🚀 Excellent consistent progress - keep up the amazing work!")
      } else if (avgRecent > 50) {
        trends.push("📈 Steady progress - you're on the right track!")
      } else {
        trends.push("💪 Progress is gradual - consider adjusting your routine for better results")
      }

      // Check for acceleration or deceleration
      const earlyScore = timelineAnalysis[0].comparison.progressScore
      const latestScore = timelineAnalysis[timelineAnalysis.length - 1].comparison.progressScore

      if (latestScore > earlyScore + 20) {
        trends.push("⚡ Your progress is accelerating - excellent momentum!")
      } else if (latestScore < earlyScore - 10) {
        trends.push("🔄 Consider refreshing your routine to reignite progress")
      }
    }

    return trends
  }

  /**
   * Generate detailed analysis report
   */
  generateAnalysisReport(singleAnalysis?: SingleImageAnalysis, comparisonAnalysis?: ComparisonAnalysis): string {
    let report = "## Fitness Photo Analysis Report\n\n"

    if (singleAnalysis) {
      report += "### Single Photo Analysis\n"
      report += `- **Muscle Definition Score**: ${singleAnalysis.muscleDefinitionScore.toFixed(1)}/100\n`
      report += `- **Image Quality**: ${singleAnalysis.imageQuality.quality} (${singleAnalysis.imageQuality.score}/100)\n`
      report += `- **Lighting Quality**: ${singleAnalysis.lightingQuality.quality}\n`
      report += `- **Edge Intensity**: ${singleAnalysis.edgeIntensity.toFixed(3)} (higher = more defined)\n`
      report += `- **Contrast**: ${singleAnalysis.contrast.toFixed(3)} (higher = more definition)\n\n`
    }

    if (comparisonAnalysis) {
      report += "### Progress Comparison\n"
      report += `- **Overall Progress Score**: ${comparisonAnalysis.progressScore}/100\n`
      report += `- **Total Change**: ${comparisonAnalysis.changePercentage}%\n`
      report += `- **Image Similarity**: ${(comparisonAnalysis.similarity * 100).toFixed(1)}%\n\n`

      report += "### Regional Analysis\n"
      report += `- **Upper Body**: ${comparisonAnalysis.regionAnalysis.upper.score}/100 (${comparisonAnalysis.regionAnalysis.upper.change}% change)\n`
      report += `- **Core/Midsection**: ${comparisonAnalysis.regionAnalysis.middle.score}/100 (${comparisonAnalysis.regionAnalysis.middle.change}% change)\n`
      report += `- **Lower Body**: ${comparisonAnalysis.regionAnalysis.lower.score}/100 (${comparisonAnalysis.regionAnalysis.lower.change}% change)\n\n`

      if (comparisonAnalysis.recommendations?.length > 0) {
        report += "### Recommendations\n"
        comparisonAnalysis.recommendations.forEach((rec, index) => {
          report += `${index + 1}. ${rec}\n`
        })
        report += "\n"
      }
    }

    report += "### Important Notes\n"
    report += "- This analysis is based on visual changes and is not medical-grade assessment\n"
    report += "- For accurate body composition analysis, consult fitness professionals\n"
    report += "- Maintain consistent lighting, pose, and camera distance for better comparison\n"
    report += "- Progress photos should be taken at the same time of day for consistency\n"

    return report
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose()
    }
  }
}
