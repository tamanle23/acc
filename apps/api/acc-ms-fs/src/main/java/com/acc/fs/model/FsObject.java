package com.acc.fs.model;

import java.util.List;

import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.acc.domain.UserBaseModel;

import com.acc.fs.FsConstants;
import com.acc.fs.model.converter.AttributeJsonConverter;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Table(name= FsConstants.TABLE_PREFIX + "object")
@Entity
public class FsObject extends UserBaseModel {

  private static final long serialVersionUID = 5210506630404322015L;
  private String rootLocation;
  private String extension;
  private boolean isPersisted;
  private Boolean isDirectory;
  private String contentType;
  private long size;
  private String checksum;
  private String name;
  private int level;

  @Convert(converter= AttributeJsonConverter.class)
  private FileAttributes attributesJson;

  @Convert(converter=FileConnectorConverter.class)
  private FileConnector connector;

  @OneToOne(mappedBy="child",fetch=FetchType.LAZY)
  @JsonIgnore
  private FsObjecRelation parent;

  @OneToMany(mappedBy="parent",fetch=FetchType.LAZY)
  @JsonIgnore
  private List<FsObjecRelation> children;

  @Transient
  private String fullPath;

  @Transient
  @JsonProperty("children")
  private List<Object> childrenFsObjects;

  @Builder(toBuilder = true)
  public FsObject(String name, String extension, String code, boolean isPersisted, boolean isDirectory
              , String contentType, FileAttributes attributesJson, FileConnector connector) {
    this.name = name;
    this.extension = extension;
    this.code = code;
    this.isPersisted = isPersisted;
    this.isDirectory = isDirectory;
    this.attributesJson = attributesJson;
    this.connector = connector;
  }
}
