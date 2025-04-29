const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  lintOnSave: false,
  pages: {
    index: {
      entry: 'src/main.js',
      template: 'public/index.html',
      filename: 'index.html',
      title: 'Network Request Recorder & Replay',
      chunks: ['chunk-vendors', 'chunk-common', 'index']
    },
  },
  configureWebpack: {
    devtool: 'cheap-source-map',
    output: {
      filename: 'js/[name].js',
      chunkFilename: 'js/[name].js'
    }
  },
  chainWebpack: config => {
    // Disable eslint
    config.module.rules.delete('eslint');
    
    config.plugin('copy').tap(([options]) => {
      options.patterns.push({
        from: 'src/assets',
        to: 'assets'
      });
      return [options];
    });

    config.optimization.minimizer('terser').tap(args => {
      args[0].terserOptions.output = {
        ...args[0].terserOptions.output,
        comments: false
      };
      return args;
    });
    
    // Disable filename hashing for extension compatibility
    config.output.filename('js/[name].js');
    config.output.chunkFilename('js/[name].js');
    config.plugin('extract-css').tap(args => {
      args[0].filename = 'css/[name].css';
      args[0].chunkFilename = 'css/[name].css';
      return args;
    });
  },
  // Copy files directly to the output directory without processing
  filenameHashing: false,
  // Output to dist folder
  outputDir: 'dist',
  // Static assets folder
  assetsDir: 'assets',
  // Set the public path to properly handle relative paths in the extension context
  publicPath: './'
})
