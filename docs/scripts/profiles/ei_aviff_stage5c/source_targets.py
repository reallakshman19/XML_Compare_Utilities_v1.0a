"""EI-AVIFF Stage 5C source-target mapping without engineering authority."""
from __future__ import annotations

from document_evidence_surface import canonical_hash

SOURCE_PROFILE = {
    "repository": "reallaksh19/Common",
    "commit": "fb549185b9b27edc2379734240320a85c5bef9f6",
    "path": "EI - AVIFF Guidelines 2nd Edition.pdf",
    "gitBlobSha1": "sha1:9d3eccc56429411e17c07a579bdebbd13cb0bdc5",
    "sizeBytes": 10348594,
    "edition": "2nd Edition",
}

TARGETS = {
    "EI_AVIFF.T3.SBC.GEOMETRY_SCORES": "TABLE",
    "EI_AVIFF.T3.SBC.LOCATION_SCORES": "TABLE",
    "EI_AVIFF.T3.SBC.FITTING_SPAN_FACTORS": "TABLE",
    "EI_AVIFF.T3.SBC.FIRST_SPAN_LIMITS": "TABLE",
    "EI_AVIFF.T3.SBC.BETWEEN_MAIN_LINES_LIMITS": "TABLE",
    "EI_AVIFF.T28.VALVE_CLOSURE_CHARACTERISTIC": "TABLE_OR_EQUATION",
    "EI_AVIFF.T29.VALVE_RECOVERY_FACTOR": "TABLE",
    "EI_AVIFF.T4.WALL_MODIFIER": "TABLE",
}


def make_source_target_decision(target_id, evidence_decision, *, source_locator=None) -> dict:
    data_type = _target_type(target_id)
    locator = _validated_locator(data_type, source_locator)
    state, diagnostics = _mapping_state(evidence_decision, locator)
    identity = {
        "schema": "EiAviffStage5C.SourceTargetDecision.v1",
        "targetId": target_id,
        "dataType": data_type,
        "source": SOURCE_PROFILE,
        "evidenceDecisionHash": evidence_decision.get("decisionHash"),
        "state": state,
        "diagnosticCodes": diagnostics,
        "publicationState": "CANDIDATE",
        "authority": {
            "engineeringAuthority": "NONE",
            "screeningAuthority": "NOT_AUTHORIZED",
            "designAuthority": False,
        },
    }
    if locator is not None:
        identity["sourceLocator"] = locator
    decision_hash = canonical_hash(identity)
    return {
        **identity,
        "sourceTargetDecisionId": f"source-target:{decision_hash[7:31]}",
        "sourceTargetDecisionHash": decision_hash,
    }


def _target_type(target_id):
    if target_id not in TARGETS:
        raise ValueError(f"unknown Stage 5C target: {target_id}")
    return TARGETS[target_id]


def _validated_locator(data_type, locator):
    if locator is None:
        return None
    required = ("pdfPage", "printedIdentifier")
    if any(locator.get(key) in (None, "") for key in required):
        raise ValueError("source locator requires pdfPage and printedIdentifier")
    identifier = str(locator["printedIdentifier"]).strip()
    if data_type.startswith("TABLE") and identifier.lower().startswith("figure t3-"):
        raise ValueError("table semantic target cannot bind to a T3 figure locator")
    return {**locator, "printedIdentifier": identifier}


def _mapping_state(evidence_decision, locator):
    state = evidence_decision.get("state")
    if state != "accepted":
        return state or "blocked", list(evidence_decision.get("diagnosticCodes", ()))
    if locator is None:
        return "blocked", ["SOURCE_LOCATOR_UNVERIFIED"]
    return "accepted", []
