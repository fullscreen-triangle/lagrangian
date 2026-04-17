"""Molecular harmonic graph: edge construction, cycle rank, fundamental cycles."""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from math import gcd

import numpy as np


@dataclass(frozen=True)
class HarmonicEdge:
    """An edge in the molecular harmonic graph.

    Mode indices (i, j) are unordered (stored with i < j). The (p, q)
    pair records the low-order integer approximant to the frequency
    ratio omega_i / omega_j.
    """

    i: int
    j: int
    p: int
    q: int
    delta: float  # fractional mistuning

    def characteristic_freq(self, omega: np.ndarray) -> float:
        """Edge-characteristic frequency: weighted mean (p*omega_i + q*omega_j)/(p+q)."""
        return (self.p * omega[self.i] + self.q * omega[self.j]) / (self.p + self.q)


def _lowest_ratio(ratio: float, eta_max: int) -> tuple[int, int, float] | None:
    """Best low-order integer approximant to `ratio`, with p + q <= eta_max.

    Returns (p, q, delta) or None if no approximant exists within bounds.
    """
    if ratio <= 0:
        return None
    best = None
    for k in range(1, eta_max):
        for p in range(1, eta_max + 1):
            q = k - p + 1
            if q < 1 or p + q > eta_max:
                continue
            if gcd(p, q) != 1:
                continue
            candidate = p / q
            delta = abs(ratio - candidate) / candidate
            if best is None or delta < best[2]:
                best = (p, q, delta)
    return best


def harmonic_graph(
    omega: np.ndarray,
    eta_max: int = 10,
    delta_tol: float = 0.05,
) -> list[HarmonicEdge]:
    """Build the molecular harmonic graph from a list of mode frequencies.

    Parameters
    ----------
    omega : (N,) array of mode frequencies (arbitrary consistent unit)
    eta_max : maximum harmonic order (p + q)
    delta_tol : maximum fractional mistuning for an edge to be included
    """
    omega = np.asarray(omega, dtype=np.float64)
    n = omega.size
    edges: list[HarmonicEdge] = []
    for i in range(n):
        for j in range(i + 1, n):
            ratio = float(omega[i] / omega[j])
            best = _lowest_ratio(ratio, eta_max)
            if best is None:
                continue
            p, q, delta = best
            if delta <= delta_tol:
                edges.append(HarmonicEdge(i=i, j=j, p=p, q=q, delta=delta))
    return edges


def _connected_components(n_vertices: int, edges: list[HarmonicEdge]) -> int:
    """Number of connected components via union-find."""
    parent = list(range(n_vertices))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x: int, y: int) -> None:
        rx, ry = find(x), find(y)
        if rx != ry:
            parent[rx] = ry

    for e in edges:
        union(e.i, e.j)
    return len({find(x) for x in range(n_vertices)})


def cycle_rank(n_vertices: int, edges: list[HarmonicEdge]) -> int:
    """Cycle rank C = |E| - |V| + K."""
    k_comp = _connected_components(n_vertices, edges)
    return max(0, len(edges) - n_vertices + k_comp)


def fundamental_cycles(
    n_vertices: int, edges: list[HarmonicEdge]
) -> list[list[HarmonicEdge]]:
    """Return a basis of fundamental cycles for the harmonic graph.

    Spanning tree is built greedily; each non-tree edge closes exactly
    one fundamental cycle.
    """
    parent = list(range(n_vertices))
    depth = [0] * n_vertices
    tree_edges: dict[tuple[int, int], HarmonicEdge] = {}

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    # Build spanning tree
    tree_adj: list[list[tuple[int, HarmonicEdge]]] = [[] for _ in range(n_vertices)]
    non_tree: list[HarmonicEdge] = []
    for e in edges:
        if find(e.i) != find(e.j):
            parent[find(e.i)] = find(e.j)
            tree_adj[e.i].append((e.j, e))
            tree_adj[e.j].append((e.i, e))
            key = (min(e.i, e.j), max(e.i, e.j))
            tree_edges[key] = e
        else:
            non_tree.append(e)

    # BFS for parent pointers and depth
    tree_parent: list[int] = [-1] * n_vertices
    tree_parent_edge: list[HarmonicEdge | None] = [None] * n_vertices
    visited = [False] * n_vertices
    for root in range(n_vertices):
        if visited[root]:
            continue
        queue = [root]
        visited[root] = True
        depth[root] = 0
        while queue:
            u = queue.pop(0)
            for v, e in tree_adj[u]:
                if not visited[v]:
                    visited[v] = True
                    tree_parent[v] = u
                    tree_parent_edge[v] = e
                    depth[v] = depth[u] + 1
                    queue.append(v)

    def path_to_root(v: int) -> list[HarmonicEdge]:
        out: list[HarmonicEdge] = []
        while tree_parent[v] != -1:
            edge = tree_parent_edge[v]
            assert edge is not None
            out.append(edge)
            v = tree_parent[v]
        return out

    def cycle_from_non_tree(e: HarmonicEdge) -> list[HarmonicEdge]:
        # Walk to LCA of e.i and e.j
        a, b = e.i, e.j
        path_a, path_b = [], []
        while depth[a] > depth[b]:
            edge = tree_parent_edge[a]
            assert edge is not None
            path_a.append(edge)
            a = tree_parent[a]
        while depth[b] > depth[a]:
            edge = tree_parent_edge[b]
            assert edge is not None
            path_b.append(edge)
            b = tree_parent[b]
        while a != b:
            edge_a = tree_parent_edge[a]
            edge_b = tree_parent_edge[b]
            assert edge_a is not None and edge_b is not None
            path_a.append(edge_a)
            path_b.append(edge_b)
            a = tree_parent[a]
            b = tree_parent[b]
        return [e] + path_a + list(reversed(path_b))

    cycles = [cycle_from_non_tree(e) for e in non_tree]
    return cycles
