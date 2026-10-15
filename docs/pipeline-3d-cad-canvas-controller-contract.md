# Pipeline CAD Canvas controller contract

The controller is the only layer allowed to translate graph events into raw TSV mutations.

```text
Table2XCanvas / Table3XCanvas
→ nodeAdded / nodeMoved / nodeDeleted
→ PipelineCadController
→ command history
→ PipelineProfileModel
→ serialized Table 2A / 3A / 3B / 3C
→ existing split-table input event pipeline
```

Canvas classes do not query or mutate textareas. Raw textarea input rebuilds the canonical model and reuses the mounted Canvas objects. Graph-originated commits retain the profile render snapshot until **Reload Graph**.
