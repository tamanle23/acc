package com.acc.core.helper;

import java.io.File;
import java.io.FileInputStream;
import java.security.MessageDigest;
import java.util.UUID;

import org.apache.commons.lang3.RandomUtils;
import org.slf4j.Logger;

import com.acc.core.logging.LoggerFactory;

public class GenerationHelper {

  private Logger logger = LoggerFactory.getLogger(GenerationHelper.class);

  public String generateCode(String prefix) {
    return this.generateCode(prefix, 10000L);
  }

  public String generateCode(String prefix, Long endExclusive) {
    if (prefix != null) {
      return prefix.concat(System.currentTimeMillis() + "_" + RandomUtils.nextLong(0, endExclusive));
    } else {
      return System.currentTimeMillis() + "_" + RandomUtils.nextLong(0, endExclusive);
    }
  }

  public String generateGuid() {
    return UUID.randomUUID().toString();//.replace("-", "");
  }

  public String generateChecksum(File file) {
    return this.generateChecksum(file, "MD5");
  }

  private String generateChecksum(File file, String digest) {
    StringBuilder sb = new StringBuilder();
    try {
      MessageDigest md = MessageDigest.getInstance(digest);
      try(FileInputStream fis = new FileInputStream(file)){
        byte[] dataBytes = new byte[1024];
        int nread = 0;
        while ((nread = fis.read(dataBytes)) != -1) {
          md.update(dataBytes, 0, nread);
        }
        byte[] mdbytes = md.digest();
        // convert the byte to hex format
        sb.append(digest);
        sb.append("-");
        for (int i = 0; i < mdbytes.length; i++) {
          sb.append(Integer.toString((mdbytes[i] & 0xff) + 0x100, 16).substring(1));
        }
      }
    } catch (Exception e) {
      logger.warn("", e);
    }
    return sb.toString();
  }
}
