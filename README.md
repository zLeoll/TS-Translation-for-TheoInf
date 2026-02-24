# TS-Translation-for-TheoInf
In this repository, you can find the Jupyter Notebooks by Professor Karl Stroetmann from the courses Algorithms and Logic, translated from Python to TypeScript.

## Prerequisites

Before you begin, make sure the following programs are installed:

- **Anaconda**: [https://www.anaconda.com/download](https://www.anaconda.com/download)
- **Node.js**: [https://nodejs.org](https://nodejs.org)


## Setup
To setup your environment, the tslab kernel and required libraries, execute the following commands in the anaconda terminal:

```bash
conda activate logic-algo
conda install -c conda-forge nodejs
conda install -c conda-forge nbclassic

npm init -y
npm install -g tslab
tslab install

npm install fraction.js mathjs logic-solver z3-solver
npm install heap-js recursive-set@8.0.0
npm install @hpcc-js/wasm pngjs
npm install --save-dev @types/pngjs
```

## Verifying installation

To verify that all libraries have been installed successfully, execute the following command in your anaconda terminal: 

```bash
jupyter nbclassic
```

Then open and execute the cells in the notebook **Test-Libraries.ipynb**, which you can find in **Algorithms/TypeScript/Chapter-02/**.
