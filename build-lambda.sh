#!/bin/bash
# Build script for AWS Lambda deployment package

echo "Building Lambda deployment package..."

# Create lambda-package directory
mkdir -p lambda-package

# Copy necessary files
echo "Copying files..."
cp index.js lambda-package/
cp package.json lambda-package/
cp -r src lambda-package/
cp .env* lambda-package/ 2>/dev/null || :  # Copy .env files if they exist

# Go to lambda package directory
cd lambda-package

# Install production dependencies
echo "Installing production dependencies..."
npm install --production

# Create zip file
echo "Creating zip file..."
zip -r ../function.zip .

cd ..

echo "Lambda package created: function.zip"
echo "You can now upload this file to AWS Lambda." 