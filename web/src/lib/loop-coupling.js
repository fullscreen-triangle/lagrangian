/**
 * Loop-coupling framework — browser-native port of the Python reference.
 *
 * Implements: harmonic graph construction, cycle rank, fundamental cycles,
 * transfer-matrix build, least-squares reconstruction, condition number.
 *
 * All computation runs client-side. No server calls. No WASM. Pure JS.
 */

// ---- Graph construction ----

/**
 * Find the best low-order rational approximant p/q to `ratio` with p+q <= etaMax.
 * Returns { p, q, delta } or null.
 */
function lowestRatio(ratio, etaMax) {
  if (ratio <= 0) return null;
  let best = null;
  for (let k = 1; k <= etaMax; k++) {
    for (let p = 1; p <= etaMax; p++) {
      const q = k - p + 1;
      if (q < 1 || p + q > etaMax) continue;
      if (gcd(p, q) !== 1) continue;
      const candidate = p / q;
      const delta = Math.abs(ratio - candidate) / candidate;
      if (best === null || delta < best.delta) {
        best = { p, q, delta };
      }
    }
  }
  return best;
}

function gcd(a, b) {
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

/**
 * Build the harmonic graph from mode frequencies.
 * @param {number[]} omega - mode frequencies
 * @param {number} etaMax - max harmonic order (default 10)
 * @param {number} deltaTol - max fractional mistuning (default 0.05)
 * @returns {{ i: number, j: number, p: number, q: number, delta: number }[]}
 */
export function harmonicGraph(omega, etaMax = 10, deltaTol = 0.05) {
  const edges = [];
  for (let i = 0; i < omega.length; i++) {
    for (let j = i + 1; j < omega.length; j++) {
      const ratio = omega[i] / omega[j];
      const best = lowestRatio(ratio, etaMax);
      if (best && best.delta <= deltaTol) {
        edges.push({ i, j, p: best.p, q: best.q, delta: best.delta });
      }
    }
  }
  return edges;
}

/** Characteristic frequency of a harmonic edge. */
export function edgeFreq(edge, omega) {
  return (edge.p * omega[edge.i] + edge.q * omega[edge.j]) / (edge.p + edge.q);
}

/** Cycle rank C = |E| - |V| + K (connected components). */
export function cycleRank(nVertices, edges) {
  const parent = Array.from({ length: nVertices }, (_, i) => i);
  function find(x) {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }
  for (const e of edges) union(e.i, e.j);
  const components = new Set();
  for (let i = 0; i < nVertices; i++) components.add(find(i));
  return Math.max(0, edges.length - nVertices + components.size);
}

/** Fundamental cycle basis via spanning-tree + non-tree edges. */
export function fundamentalCycles(nVertices, edges) {
  const parent = Array.from({ length: nVertices }, (_, i) => i);
  function find(x) {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  const treeAdj = Array.from({ length: nVertices }, () => []);
  const nonTree = [];
  for (const e of edges) {
    if (find(e.i) !== find(e.j)) {
      parent[find(e.i)] = find(e.j);
      treeAdj[e.i].push({ v: e.j, edge: e });
      treeAdj[e.j].push({ v: e.i, edge: e });
    } else {
      nonTree.push(e);
    }
  }
  // BFS for tree parent pointers
  const treeParent = new Int32Array(nVertices).fill(-1);
  const treeParentEdge = new Array(nVertices).fill(null);
  const depth = new Int32Array(nVertices);
  const visited = new Uint8Array(nVertices);
  for (let root = 0; root < nVertices; root++) {
    if (visited[root]) continue;
    visited[root] = 1;
    const queue = [root];
    while (queue.length) {
      const u = queue.shift();
      for (const { v, edge } of treeAdj[u]) {
        if (!visited[v]) {
          visited[v] = 1;
          treeParent[v] = u;
          treeParentEdge[v] = edge;
          depth[v] = depth[u] + 1;
          queue.push(v);
        }
      }
    }
  }
  // For each non-tree edge, walk to LCA to get the fundamental cycle
  return nonTree.map(e => {
    let a = e.i, b = e.j;
    const pathA = [], pathB = [];
    while (depth[a] > depth[b]) { pathA.push(treeParentEdge[a]); a = treeParent[a]; }
    while (depth[b] > depth[a]) { pathB.push(treeParentEdge[b]); b = treeParent[b]; }
    while (a !== b) {
      pathA.push(treeParentEdge[a]); a = treeParent[a];
      pathB.push(treeParentEdge[b]); b = treeParent[b];
    }
    return [e, ...pathA, ...pathB.reverse()];
  });
}

// ---- Transfer matrix ----

/** Deterministic pseudo-random unit vector per seed. */
function dipoleOrientation(seed) {
  // Simple LCG for reproducible directions
  let s = (seed + 17) * 2654435761 >>> 0;
  const u = () => { s = (s * 1103515245 + 12345) >>> 0; return (s / 4294967296) * 2 - 1; };
  const v = [u(), u(), u()];
  const norm = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2) || 1;
  return v.map(x => x / norm);
}

function angularWeight(direction, edge) {
  const mi = dipoleOrientation(edge.i);
  const mj = dipoleOrientation(edge.j);
  const cross = [
    mi[1] * mj[2] - mi[2] * mj[1],
    mi[2] * mj[0] - mi[0] * mj[2],
    mi[0] * mj[1] - mi[1] * mj[0],
  ];
  const norm = Math.sqrt(cross[0] ** 2 + cross[1] ** 2 + cross[2] ** 2) || 1;
  return Math.abs(direction[0] * cross[0] / norm +
                  direction[1] * cross[1] / norm +
                  direction[2] * cross[2] / norm);
}

/**
 * Build the (C+1) x K transfer matrix (real-valued simplification for demo).
 * @param {number[]} omega
 * @param {object[]} edges
 * @param {{ direction: number[], wavelength: number }[]} sources
 * @returns {number[][]} A matrix as array of rows
 */
export function buildTransferMatrix(omega, edges, sources) {
  const cycles = fundamentalCycles(omega.length, edges);
  const C = cycles.length;
  const K = sources.length;
  const meanOmega = omega.reduce((a, b) => a + b, 0) / omega.length;

  // Row characteristic frequencies
  const rowFreqs = [meanOmega * 1.3]; // direct path
  for (const cyc of cycles) {
    const cf = cyc.reduce((s, e) => s + edgeFreq(e, omega), 0) / cyc.length;
    rowFreqs.push(cf);
  }

  const A = [];
  for (let c = 0; c <= C; c++) {
    const row = [];
    for (let k = 0; k < K; k++) {
      const src = sources[k];
      let alpha;
      if (c === 0) {
        const d0 = dipoleOrientation(0);
        alpha = Math.max(Math.abs(src.direction[0] * d0[0] +
          src.direction[1] * d0[1] + src.direction[2] * d0[2]), 0.15);
      } else {
        const vals = cycles[c - 1].map(e => angularWeight(src.direction, e));
        alpha = Math.max(vals.reduce((a, b) => a + b, 0) / vals.length, 0.15);
      }
      const phase = 2 * Math.PI * rowFreqs[c] * src.wavelength;
      row.push(alpha * Math.cos(phase)); // real part for demo
    }
    A.push(row);
  }
  return A;
}

/** Least-squares solve A x = b via normal equations (small matrices only). */
export function solveLeastSquares(A, b) {
  const m = A.length, n = A[0].length;
  // AtA = A^T A
  const AtA = Array.from({ length: n }, () => new Float64Array(n));
  const Atb = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < m; k++) sum += A[k][i] * A[k][j];
      AtA[i][j] = sum;
    }
    for (let k = 0; k < m; k++) Atb[i] += A[k][i] * b[k];
  }
  // Regularise
  for (let i = 0; i < n; i++) AtA[i][i] += 1e-10;
  // Cholesky-ish solve (for small n, use Gauss elimination)
  return gaussSolve(AtA, Atb);
}

function gaussSolve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-15) continue;
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i] || 1;
  }
  return Array.from(x);
}

/** Condition number via ratio of max/min column norms (approximation). */
export function conditionNumber(A) {
  const m = A.length, n = A[0].length;
  const colNorms = [];
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < m; i++) s += A[i][j] ** 2;
    colNorms.push(Math.sqrt(s));
  }
  const maxN = Math.max(...colNorms);
  const minN = Math.min(...colNorms);
  return minN > 1e-15 ? maxN / minN : Infinity;
}

// ---- Presets ----

export const BENZENE_OMEGA = [673, 1038, 1486, 3068, 3099];
export const WATER_OMEGA = [1595, 3657, 3756];
export const CO2_OMEGA = [667, 1388, 2349];
export const METHANE_OMEGA = [1306, 1534, 2917, 3019];

export const MOLECULE_PRESETS = {
  "Benzene": BENZENE_OMEGA,
  "Water": WATER_OMEGA,
  "CO₂": CO2_OMEGA,
  "Methane": METHANE_OMEGA,
};
