const path = require('path');
const { UnusedFilesWebpackPlugin } = require('unused-files-webpack-plugin');
const webpack = require('webpack')


module.exports = (env, args) => {
    const is_rel_env = args.mode === "production";
    
    
    return {
        context: __dirname,
        devtool: is_rel_env ? undefined : "inline-source-map",
        entry: "./src/index.ts",
        optimization: {
            splitChunks: {
                cacheGroups: {
                	/*jquery:{
                    	test: /[\\/]node_modules[\\/](jquery|jquery-ui)[\\/]/,
                        name: "jquery-compiled",
                        chunks: "all"
                    }*/
                },
            }
        },
        output: {
            path: __dirname + "/../demo/fsgraph/lib",
            filename: "SciViFSGraph.[name].js",
            library: ["SciViFSGraph", "[name]"]
        },
        plugins:[
            new UnusedFilesWebpackPlugin()
        ],
        module: {
            rules: [
                {
                    test: /\.(ts|js)$/,
                    exclude: /node_modules(?![\\/]@scivi)/,
                    loader: 'ts-loader'
                },
                {
                    test: /\.css$/,
                    use: [
                        {
                            loader: 'style-loader',
                            options: {
                                attrs: {
                                    'title': 'webpack-compiled'
                                },
                                singleton: true
                            }
                        },
                        {
                            loader: 'css-loader',
                            options: {
                                modules: true
                            }
                        }
                    ],
                },
            ]
        },

        resolve: {
            extensions: [ '.js', '.ts'],
            symlinks: false
        },
        stats: {
            excludeModules: false,
            maxModules: 100
        },
        externals: {
            fetch: 'jquery'
        }
    }
}