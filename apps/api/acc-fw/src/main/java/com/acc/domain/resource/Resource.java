package com.acc.domain.resource;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "acc_resource",
	uniqueConstraints=@UniqueConstraint(columnNames={"category", "resourceKey"}))

public class Resource{

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@JsonProperty("uid")
	private Long id;

	private String resourceKey;

	private String messageKey;

	private String value;

	private String value2;

	private String value3;

	private String category;

	private String resourceGroup;

	public String getResourceKey() {
		return resourceKey;
	}

	public void setResourceKey(String key) {
		this.resourceKey = key;
	}

	public String getMessageKey() {
		return messageKey;
	}

	public void setMessageKey(String messageKey) {
		this.messageKey = messageKey;
	}

	public String getValue() {
		return value;
	}

	public void setValue(String value) {
		this.value = value;
	}

	public String getCategory() {
		return category;
	}

	public void setCategory(String category) {
		this.category = category;
	}

	public String getResourceGroup() {
		return resourceGroup;
	}

	public void setResourceGroup(String resourceGroup) {
		this.resourceGroup = resourceGroup;
	}

	public String getValue2() {
		return value2;
	}

	public void setValue2(String value2) {
		this.value2 = value2;
	}

	public String getValue3() {
		return value3;
	}

	public void setValue3(String value3) {
		this.value3 = value3;
	}

}
