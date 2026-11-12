package com.acc.fs.controller.request;

import java.util.List;

import com.acc.fs.model.FsObject;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FileDropRequestBody {
  List<FsObject> cut;
  List<FsObject> copy;
  FsObject target;
}
