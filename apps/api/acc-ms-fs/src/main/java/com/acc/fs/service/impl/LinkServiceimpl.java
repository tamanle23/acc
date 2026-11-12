package com.acc.fs.service.impl;

import com.acc.fs.controller.response.Link;
import com.acc.fs.service.FileService;
import com.acc.fs.service.LinkService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class LinkServiceimpl implements LinkService {

  @Autowired
  FileService fileService;

  @Override
  public Link getLink(String uid) {
    Object fsObject = fileService.findByUid(uid);
    return null;
  }
}
