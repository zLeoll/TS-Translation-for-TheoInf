# TS-Translation-for-TheoInf
In this repository, you can find the Jupyter Notebooks by Professor Karl Stroetmann from the courses Algorithms and Logic, translated from Python to TypeScript.

## Setup
To setup your environment, execute the following commands in your anaconda terminal:

```bash
conda activate base
conda install nodejs
conda install -c conda-forge nbclassic
tslab install
npm install -g tslab
npm install fraction.js
npm install mathjs
npm install @hpcc-js/wasm
npm install pngjs
npm install heap-js
npm install logic-solver
npm install z3-solver
```

## Verifying installation

To verify that all libraries have been installed successfully, execute the following command in your anaconda terminal: 

```bash
jupyter nbclassic
```

Then open and execute the cells in the notebook **Test-Libraries.ipynb**, which you can find in **Algorithms/TypeScript/Chapter-02/**.
