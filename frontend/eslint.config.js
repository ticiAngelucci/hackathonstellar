const {defineConfig}=require('eslint/config');
const expo=require('eslint-config-expo/flat');
// Reanimated shared values intentionally mutate .value; React Compiler is not enabled.
module.exports=defineConfig([expo,{ignores:['.expo/**','.cache/**','dist/**','scripts/**']},{rules:{'react-hooks/immutability':'off','react-hooks/set-state-in-effect':'warn'}}]);

