from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import yaml


REQUIRED_SNAPSHOT_FIELDS = {
    "profile_item_id",
    "profile_item_version",
    "category",
    "value",
    "sensitivity",
    "reason_code",
}


def load_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = yaml.safe_load(handle)
    if not isinstance(value, dict):
        raise ValueError("policy root must be a mapping")
    return value


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError("schema root must be an object")
    return value


def validate_schema(policy: dict[str, Any], schema: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    required = set(schema.get("required", []))
    missing = required - set(policy)
    if missing:
        errors.append(f"schema:<root>: missing required keys {sorted(missing)}")

    if schema.get("additionalProperties") is False:
        allowed = set(schema.get("properties", {}))
        unknown = set(policy) - allowed
        if unknown:
            errors.append(f"schema:<root>: unknown keys {sorted(unknown)}")

    properties = schema.get("properties", {})
    for key in ("schema_version",):
        expected = properties.get(key, {}).get("const")
        if expected is not None and policy.get(key) != expected:
            errors.append(
                f"schema:{key}: expected {expected!r}, got {policy.get(key)!r}"
            )

    for section in ("defaults", "clarification", "global_rules", "llm_contract"):
        section_schema = properties.get(section, {})
        section_value = policy.get(section)
        if not isinstance(section_value, dict):
            errors.append(f"schema:{section}: expected mapping")
            continue
        section_required = set(section_schema.get("required", []))
        section_missing = section_required - set(section_value)
        if section_missing:
            errors.append(
                f"schema:{section}: missing required keys {sorted(section_missing)}"
            )
        if section_schema.get("additionalProperties") is False:
            section_allowed = set(section_schema.get("properties", {}))
            section_unknown = set(section_value) - section_allowed
            if section_unknown:
                errors.append(
                    f"schema:{section}: unknown keys {sorted(section_unknown)}"
                )
        for child_key, child_schema in section_schema.get("properties", {}).items():
            if "const" in child_schema and section_value.get(child_key) != child_schema["const"]:
                errors.append(
                    f"schema:{section}.{child_key}: expected "
                    f"{child_schema['const']!r}, got {section_value.get(child_key)!r}"
                )

    for section in (
        "profile_categories",
        "sensitivity_policy",
        "reason_codes",
        "intents",
        "approval",
        "audit",
    ):
        if section in policy and not isinstance(policy[section], dict):
            errors.append(f"schema:{section}: expected mapping")

    return errors


def validate_cross_references(policy: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    categories = policy["profile_categories"]
    reason_codes = policy["reason_codes"]
    intents = policy["intents"]

    for reason_code, config in reason_codes.items():
        for category in config["applies_to"]:
            if category not in categories:
                errors.append(
                    f"reason_codes.{reason_code}: unknown category {category!r}"
                )

    for intent_name, intent in intents.items():
        required_slots = set(intent["required_slots"])
        resolution_slots = set(intent["slot_resolution"])
        missing_resolution = required_slots - resolution_slots
        if missing_resolution:
            errors.append(
                f"intents.{intent_name}: missing slot_resolution for "
                f"{sorted(missing_resolution)}"
            )

        for category in intent["allowed_categories"]:
            if category not in categories:
                errors.append(
                    f"intents.{intent_name}: unknown allowed category {category!r}"
                )
                continue
            sensitivity = categories[category]["sensitivity"]
            if sensitivity != "normal":
                errors.append(
                    f"intents.{intent_name}: {category!r} is {sensitivity}; "
                    "non-normal categories belong in sensitive_purpose_rules"
                )

        for slot_name, resolution in intent["slot_resolution"].items():
            for category in resolution["profile_categories"]:
                if category not in categories:
                    errors.append(
                        f"intents.{intent_name}.slot_resolution.{slot_name}: "
                        f"unknown category {category!r}"
                    )

        for rule in intent["sensitive_purpose_rules"]:
            category = rule["category"]
            reason_code = rule["reason_code"]
            if category not in categories:
                errors.append(
                    f"intents.{intent_name}: unknown sensitive category {category!r}"
                )
                continue
            if categories[category]["sensitivity"] != "sensitive":
                errors.append(
                    f"intents.{intent_name}: purpose rule category {category!r} "
                    "must have sensitivity 'sensitive'"
                )
            if reason_code not in reason_codes:
                errors.append(
                    f"intents.{intent_name}: unknown reason_code {reason_code!r}"
                )
            elif category not in reason_codes[reason_code]["applies_to"]:
                errors.append(
                    f"intents.{intent_name}: reason_code {reason_code!r} "
                    f"does not apply to {category!r}"
                )

    snapshot_fields = set(policy["approval"]["snapshot_fields"])
    missing_fields = REQUIRED_SNAPSHOT_FIELDS - snapshot_fields
    if missing_fields:
        errors.append(
            f"approval.snapshot_fields: missing {sorted(missing_fields)}"
        )

    allowed_audit = set(policy["audit"]["allowed_fields"])
    forbidden_audit = set(policy["audit"]["forbidden_fields"])
    overlap = allowed_audit & forbidden_audit
    if overlap:
        errors.append(
            f"audit: fields cannot be both allowed and forbidden: {sorted(overlap)}"
        )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate Context Bridge policy schema and references."
    )
    parser.add_argument(
        "policy",
        nargs="?",
        type=Path,
        default=Path("specs/context-policy.yaml"),
    )
    parser.add_argument(
        "schema",
        nargs="?",
        type=Path,
        default=Path("specs/context-policy.schema.json"),
    )
    args = parser.parse_args()

    try:
        policy = load_yaml(args.policy)
        schema = load_json(args.schema)
    except (OSError, ValueError, yaml.YAMLError, json.JSONDecodeError) as error:
        print(f"POLICY VALIDATION BLOCKED: {error}", file=sys.stderr)
        return 2

    errors = validate_schema(policy, schema)
    if not errors:
        errors.extend(validate_cross_references(policy))

    if errors:
        print("POLICY VALIDATION FAILED", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        f"POLICY VALIDATION PASSED: {policy['policy_id']} "
        f"v{policy['policy_version']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
