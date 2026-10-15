# InputXML Producer Worker Adapter

Adds `producer.categorizeInputXml` to the existing CategorizedInputXML browser-worker protocol.

The operation accepts producer-tagged raw InputXML, invokes the existing categorizer, validates the generated `categorized-inputxml/v3` document, and returns traceable source/output fingerprints.

No producer module is switched in this Work Pack.
