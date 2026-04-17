# Observatory — convenience entry points.
#
# Targets:
#   help         list targets
#   validate     run Python validation suites for both papers
#   figures      regenerate the PNG panels for both papers
#   papers       build both papers' PDFs (requires pdflatex + bibtex)
#   rust         build all Rust crates (release)
#   rust-test    run Rust tests
#   web-dev      start the Next.js dev server
#   web-build    produce the static export at web/out/
#   clean        remove build artefacts, keep source

SHELL := bash
PYTHON ?= python
NPM ?= npm
CARGO ?= cargo

SHADER_PKG := publication/shader-based-astronomy
GTHREE_PKG := publication/universal-partition-depth-observatory
LOOP_PKG   := publication/harmonic-scattering-loop-coupling

.PHONY: help validate validate-shader validate-gthree validate-loop figures figures-shader \
        figures-gthree papers papers-shader papers-gthree papers-loop rust rust-test \
        web-dev web-build clean

help:
	@echo "Observatory — available targets:"
	@echo "  make validate     run Python validation for both papers"
	@echo "  make figures      regenerate publication figure panels"
	@echo "  make papers       compile both papers' PDFs"
	@echo "  make rust         cargo build --release"
	@echo "  make rust-test    cargo test --release"
	@echo "  make web-dev      start the Next.js dev server"
	@echo "  make web-build    produce the static export at web/out/"
	@echo "  make clean        remove build artefacts"

validate: validate-shader validate-gthree validate-loop

validate-shader:
	cd $(SHADER_PKG)/python && \
	  PYTHONPATH=src PYTHONIOENCODING=utf-8 $(PYTHON) -m shader_astronomy.cli \
	    --output-dir ../output

validate-gthree:
	cd $(GTHREE_PKG)/python && \
	  PYTHONPATH=src PYTHONIOENCODING=utf-8 $(PYTHON) -m gthree.cli \
	    --output-dir ../output

validate-loop:
	cd $(LOOP_PKG)/python && \
	  PYTHONPATH=src PYTHONIOENCODING=utf-8 $(PYTHON) -m loop_coupling.cli \
	    --output-dir ../output

figures: figures-shader figures-gthree

figures-shader:
	cd $(SHADER_PKG)/python && \
	  PYTHONPATH=src PYTHONIOENCODING=utf-8 $(PYTHON) -m shader_astronomy.plots \
	    --output-dir ../figures

figures-gthree:
	cd $(GTHREE_PKG)/python && \
	  PYTHONPATH=src PYTHONIOENCODING=utf-8 $(PYTHON) -m gthree.plots \
	    --output-dir ../figures

papers: papers-shader papers-gthree papers-loop

papers-shader:
	cd $(SHADER_PKG) && \
	  pdflatex -interaction=nonstopmode shader-based-astronomy.tex && \
	  bibtex shader-based-astronomy || true && \
	  pdflatex -interaction=nonstopmode shader-based-astronomy.tex && \
	  pdflatex -interaction=nonstopmode shader-based-astronomy.tex

papers-gthree:
	cd $(GTHREE_PKG) && \
	  pdflatex -interaction=nonstopmode universal-partition-depth-observatory.tex && \
	  bibtex universal-partition-depth-observatory || true && \
	  pdflatex -interaction=nonstopmode universal-partition-depth-observatory.tex && \
	  pdflatex -interaction=nonstopmode universal-partition-depth-observatory.tex

papers-loop:
	cd $(LOOP_PKG) && \
	  pdflatex -interaction=nonstopmode harmonic-scattering-loop-coupling-map.tex && \
	  bibtex harmonic-scattering-loop-coupling-map || true && \
	  pdflatex -interaction=nonstopmode harmonic-scattering-loop-coupling-map.tex && \
	  pdflatex -interaction=nonstopmode harmonic-scattering-loop-coupling-map.tex

rust:
	$(CARGO) build --release

rust-test:
	$(CARGO) test --release

web-dev:
	cd web && $(NPM) run dev

web-build:
	cd web && $(NPM) run build

clean:
	rm -rf $(SHADER_PKG)/output $(SHADER_PKG)/figures
	rm -rf $(GTHREE_PKG)/output $(GTHREE_PKG)/figures
	rm -rf $(LOOP_PKG)/output
	rm -rf target
	rm -rf web/.next web/out
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.egg-info" -type d -exec rm -rf {} + 2>/dev/null || true
	find . -name ".pytest_cache" -type d -exec rm -rf {} + 2>/dev/null || true
	@echo "done."
