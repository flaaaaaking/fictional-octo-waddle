param()

# Rebuild the five report characters from the approved group-portrait master.
# This guarantees identical hair, clothes, props, linework, and colors.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $projectRoot 'public\bigfive-guides-v2.png'
$publicOutput = Join-Path $projectRoot 'public\characters'
$pagesOutput = Join-Path $projectRoot 'characters'

$characters = [ordered]@{
  'openness.png' = @(35, 70, 320, 750)
  'conscientiousness.png' = @(390, 65, 335, 760)
  'extraversion.png' = @(700, 55, 410, 770)
  'agreeableness.png' = @(1120, 55, 310, 770)
  'emotional-sensitivity.png' = @(1435, 45, 340, 780)
}

$source = [System.Drawing.Bitmap]::FromFile($sourcePath)
try {
  foreach ($entry in $characters.GetEnumerator()) {
    $box = $entry.Value
    $canvas = New-Object System.Drawing.Bitmap 800, 1000
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    try {
      $graphics.Clear([System.Drawing.Color]::White)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $scale = [Math]::Min(720.0 / $box[2], 940.0 / $box[3])
      $width = [int]($box[2] * $scale)
      $height = [int]($box[3] * $scale)
      $x = [int](($canvas.Width - $width) / 2)
      $y = $canvas.Height - $height - 24
      $sourceRect = New-Object System.Drawing.Rectangle $box[0], $box[1], $box[2], $box[3]
      $destRect = New-Object System.Drawing.Rectangle $x, $y, $width, $height
      $graphics.DrawImage($source, $destRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
      # Remove the tiny neighboring-character fragments that fall inside two
      # overlapping source boxes while preserving the featured character.
      if ($entry.Key -eq 'conscientiousness.png') {
        $graphics.FillRectangle([System.Drawing.Brushes]::White, 600, 220, 200, 250)
      }
      if ($entry.Key -eq 'extraversion.png') {
        $graphics.FillRectangle([System.Drawing.Brushes]::White, 0, 620, 215, 380)
      }
      foreach ($folder in @($publicOutput, $pagesOutput)) {
        [System.IO.Directory]::CreateDirectory($folder) | Out-Null
        $canvas.Save((Join-Path $folder $entry.Key), [System.Drawing.Imaging.ImageFormat]::Png)
      }
    }
    finally {
      $graphics.Dispose()
      $canvas.Dispose()
    }
  }
}
finally {
  $source.Dispose()
}
