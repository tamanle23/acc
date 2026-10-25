package com.acc.aio;

import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.fail;

public class YamlValidationTest {

    @Test
    public void validateAllYamlFiles() throws Exception {
        Yaml yaml = new Yaml();
        Path resourcesPath = Paths.get("src/main/resources");
        
        if (Files.exists(resourcesPath)) {
            try (Stream<Path> paths = Files.walk(resourcesPath)) {
                paths.filter(path -> path.toString().endsWith(".yml") || path.toString().endsWith(".yaml"))
                     .forEach(path -> {
                         try (InputStream in = Files.newInputStream(path)) {
                             // Load all documents in the YAML file to ensure full syntax check
                             for (Object data : yaml.loadAll(in)) {
                                 // iterating forces parsing
                             }
                         } catch (Exception e) {
                             fail("Failed to parse YAML file: " + path + ". Error: " + e.getMessage());
                         }
                     });
            }
        }
    }
}
