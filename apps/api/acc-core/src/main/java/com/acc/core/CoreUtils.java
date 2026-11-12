package com.acc.core;

import org.owasp.esapi.ESAPI;
import org.owasp.esapi.codecs.Codec;
import org.owasp.esapi.codecs.MySQLCodec;
import org.owasp.esapi.codecs.OracleCodec;

public class CoreUtils {
  public static String escapeSql(String input, String dbId) {
    Codec<Character> codec;
    if(dbId != null) {
      switch(dbId) {
        case "oracle":
          codec = new OracleCodec();
          break;
        case "mysql":
        case "mariadb":
          codec = new MySQLCodec(MySQLCodec.Mode.ANSI);
          break;
        default:
          codec = new MySQLCodec(MySQLCodec.Mode.ANSI);
      }
    } else {
      codec = new MySQLCodec(MySQLCodec.Mode.ANSI);
    }
    return ESAPI.encoder().encodeForSQL(codec, input);
  }
}
