package com.acc.boot.config.properties;

public class Jpa {
	private String schemaGeneration;
	private String schemaScriptGeneration;
	private String schemaScriptGenerationCreateTarget;
	private String schemaScriptGenerationDropTarget;

	public String getSchemaGeneration() {
		return schemaGeneration;
	}

	public void setSchemaGeneration(String schemaGeneration) {
		this.schemaGeneration = schemaGeneration;
	}

	public String getSchemaScriptGeneration() {
		return schemaScriptGeneration;
	}

	public void setSchemaScriptGeneration(String schemaScriptGeneration) {
		this.schemaScriptGeneration = schemaScriptGeneration;
	}

	public String getSchemaScriptGenerationCreateTarget() {
		return schemaScriptGenerationCreateTarget;
	}

	public void setSchemaScriptGenerationCreateTarget(String schemaScriptGenerationCreateTarget) {
		this.schemaScriptGenerationCreateTarget = schemaScriptGenerationCreateTarget;
	}

	public String getSchemaScriptGenerationDropTarget() {
		return schemaScriptGenerationDropTarget;
	}

	public void setSchemaScriptGenerationDropTarget(String schemaScriptGenerationDropTarget) {
		this.schemaScriptGenerationDropTarget = schemaScriptGenerationDropTarget;
	}
}