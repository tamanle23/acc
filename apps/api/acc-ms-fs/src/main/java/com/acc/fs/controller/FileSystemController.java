package com.acc.fs.controller;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

import jakarta.servlet.http.HttpServletRequest;

import com.acc.fs.config.MultipartHelper;
import com.acc.core.io.ContextHeader;
import com.acc.core.io.ResponseWrapper;
import com.acc.fs.connector.impl.FileSystemStorageConnector;
import com.acc.fs.model.FileAttributes;
import com.acc.fs.service.FileService;
import com.acc.fs.connector.StorageServiceFactory;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.mvc.method.annotation.MvcUriComponentsBuilder;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/fs/explorer")
public class FileSystemController {

  private Logger logger = LoggerFactory.getLogger(FileSystemController.class);

  @Autowired
  StorageServiceFactory storageServiceFactory;

  @Autowired
  FileService fileService;

  @Autowired
  FileSystemStorageConnector storageConnector;

  @Autowired
  MultipartHelper multipartHelper;

  @GetMapping("/uploadForm")
  public String listUploadedFiles(Model model) throws IOException {
    model.addAttribute("files",this.getAllFiles());
    return "uploadForm";
  }

  @GetMapping("/plainUploadForm")
  public String uploadForm3(Model model) throws IOException {
    model.addAttribute("files", this.getAllFiles()
    );
    return "plainUploadForm";
  }

  @GetMapping
  public String explore(Model model) throws IOException {
    model.addAttribute("files", this.getAllFiles());
    return "explorer";
  }

  @GetMapping("/player")
  public String player(Model model) throws IOException {
    model.addAttribute("files",this.getAllFiles());
    return "player";
  }

  @GetMapping("/all")
  @ResponseBody
  public List<String> list() {
    return this.getAllFiles();
  }

  @GetMapping("/download/{filename:.+}")
  @ResponseBody
  public ResponseEntity<Resource> serveFile(@PathVariable("filename") String filename) {
    Resource resource = storageConnector.loadAsResource(FileAttributes.builder().code(filename).build());
    return ResponseEntity.ok()
                         .header(HttpHeaders.CONTENT_DISPOSITION
                                ,"attachment; filename=\"" + resource.getFilename() + "\"")
                         .body(resource);
  }

  @PostMapping
  public String handleFileUpload(HttpServletRequest request,RedirectAttributes redirectAttributes) {
    StringBuilder msgBuilder = new StringBuilder();
    this.multipartHelper.parseRequest(request
                                      , fileItem -> {
                                          try {
                                            storageConnector.store(fileItem.getInputStream(),0, fileItem.getName());
                                          } catch (IOException e) {
                                            msgBuilder.append(fileItem.getName());
                                          }
                                        });
    if(msgBuilder.length()>0){
      redirectAttributes.addFlashAttribute("message", "Uploading failed!\n" + msgBuilder.toString());
    } else {
      redirectAttributes.addFlashAttribute("message", "Uploading successfully!");
    }
    return "redirect:/";
  }

  @PostMapping("/async")
  @ResponseBody
  public ResponseWrapper<ContextHeader, Void> handleAjaxFileUpload(HttpServletRequest request) {
    this.multipartHelper.parseRequest(request, fileItem -> {
      if(!fileItem.isFormField())
      try {
        storageConnector.store(fileItem.getInputStream(),0, fileItem.getName());
      } catch (IOException e) {
        logger.warn("Cannot open upload file stream.", e);
      }
    });
    return ResponseWrapper.success();
  }

  private List<String> getAllFiles() {
    return storageConnector.list(null)
                         .map(path ->
                                 MvcUriComponentsBuilder.fromMethodName(FileSystemController.class, "serveFile" , path.getFileName().toString())
                                                        .build()
                                                        .toString()
                         )
                         .collect(Collectors.toList());
  }
}
