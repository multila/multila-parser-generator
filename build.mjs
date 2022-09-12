/*
  MULTILA Compiler and Computer Architecture Infrastructure
  Copyright (c) 2022 by Andreas Schwenk, contact@multila.org
  Licensed by GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007
*/

import * as esbuild from 'esbuild';

esbuild.buildSync({
  platform: 'node',
  minify: true,
  target: 'node11',
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'build/multila-parser-generator.min.js',
});
