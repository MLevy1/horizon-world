# Horizon 0.3.1

The 3D explorer and [Hydrology Atlas](hydrology.html) now share one
hydrology-first geographic model for a bounded 65.536 km domain.

- [World explorer](index.html)
- [Hydrology Atlas](hydrology.html)
- [Scope and limitations](HYDROLOGY-03.md)

Forests, coastlines, terrain streaming, flight and navigation are retained.
Inland river and lake water rendering is temporarily disabled because the
new graph does not yet contain valid water-surface geometry.

Run `node --test tests/hydrology.test.mjs tests/hydrology-terrain.test.mjs`.
