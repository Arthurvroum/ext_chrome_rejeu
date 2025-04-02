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
    },
  },
  configureWebpack: {
    devtool: 'source-map'
  },
  // Copy files directly to the output directory instead of inlining them
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
  },
  // Set the public path to properly handle relative paths in the extension context
  publicPath: './'
})
