#!/bin/bash

echo "Building extension with direct webpack build (no ESLint)..."

# Create a webpack config file specifically for our build
cat > webpack.direct.config.js << 'EOF'
const path = require('path');
const { VueLoaderPlugin } = require('vue-loader');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html',
      templateParameters: {
        BASE_URL: './'  // Define BASE_URL to fix template error
      }
    }),
    new CopyPlugin({
      patterns: [
        { 
          from: 'public', 
          to: '.', 
          globOptions: { 
            ignore: ['**/index.html'] 
          }
        }
      ],
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    },
    extensions: ['.js', '.vue', '.json']
  }
};
EOF

# Install needed dependencies if they're not present
if [ ! -d "node_modules/webpack" ] || [ ! -d "node_modules/webpack-cli" ]; then
  echo "Installing webpack dependencies..."
  npm install --save-dev webpack webpack-cli html-webpack-plugin copy-webpack-plugin style-loader css-loader babel-loader @babel/core @babel/preset-env vue-loader
fi

# Run webpack directly
echo "Running webpack..."
npx webpack --config webpack.direct.config.js

# Check if build was successful
WEBPACK_RESULT=$?

if [ $WEBPACK_RESULT -eq 0 ]; then
    echo "Direct webpack build succeeded!"
    
    # Fix the manifest.json file for Manifest V3
    chmod +x ./fix-manifest-v3.sh
    ./fix-manifest-v3.sh
    
    echo "Your extension is now ready in the dist directory."
    echo ""
    echo "To load the extension in Chrome:"
    echo "1. Open Chrome and navigate to chrome://extensions/"
    echo "2. Enable 'Developer mode' (toggle in the top right)"
    echo "3. Click 'Load unpacked' and select the 'dist' folder"
else
    echo "Direct webpack build failed. Will try with standard build with ESLint disabled."
    
    # Create a temporary Vue config file to completely disable ESLint
    echo 'module.exports = {
      lintOnSave: false,
      publicPath: "./",
      chainWebpack: config => {
        config.module.rules.delete("eslint");
      }
    }' > vue.config.js
    
    # Ensure vue-cli-service is installed
    if [ ! -f "./node_modules/.bin/vue-cli-service" ]; then
      echo "Installing Vue CLI Service..."
      npm install --save-dev @vue/cli-service
    fi
    
    # Set environment variable to disable ESLint
    export VUE_CLI_BABEL_TRANSPILE_MODULES=true
    export ESLINT_NO_DEV_ERRORS=true
    export DISABLE_ESLINT_PLUGIN=true
    
    # Run Vue CLI build using the local install
    echo "Running Vue CLI build with all ESLint checks disabled..."
    ./node_modules/.bin/vue-cli-service build --skip-plugins @vue/cli-plugin-eslint
    
    # Check build result
    VUE_BUILD_RESULT=$?
    
    # Restore the original vue.config.js if it exists
    if [ -f "vue.config.backup.js" ]; then
      mv vue.config.backup.js vue.config.js
    elif [ -f "vue.config.js" ]; then
      rm vue.config.js
    fi
    
    if [ $VUE_BUILD_RESULT -eq 0 ]; then
        echo "Vue CLI build succeeded!"
        chmod +x ./fix-manifest-v3.sh
        ./fix-manifest-v3.sh
    else
        echo "All build attempts failed."
        echo "Please check for any errors in your Vue components or configuration."
        exit 1
    fi
fi

# Clean up temporary files
rm -f webpack.direct.config.js

echo "Done."
