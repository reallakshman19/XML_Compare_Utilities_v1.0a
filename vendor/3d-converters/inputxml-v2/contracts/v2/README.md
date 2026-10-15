# InputXML release contracts v2

These contracts define the fail-closed release evidence shared by
`3D_Converters` and read-only downstream consumers. A release is valid only
when `SelectedOutputManifest.v1` identifies a `PASS` assurance ledger and every
referenced file matches its SHA-256 and byte length.

`TopologyParityReport.v2` is the sole post-serialization parity proof. There is
no separate post-canonical parity artifact. Legacy v1 artifacts remain readable
for historical review but are not release eligible.
