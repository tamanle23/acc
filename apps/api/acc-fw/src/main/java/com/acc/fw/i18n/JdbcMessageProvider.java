package com.acc.fw.i18n;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Locale;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.stereotype.Component;
import org.springframework.util.Assert;

import com.acc.fw.helper.LocaleHelpers;

@Component
public class JdbcMessageProvider implements MessageProvider {

	protected static final String QUERY_SELECT_MESSAGES = "SELECT %s,%s,%s,%s,%s FROM %s";
	
	private Logger logger = LoggerFactory.getLogger(JdbcMessageProvider.class);

	private JdbcTemplate template;

	private String languageColumn = "language";
	private String countryColumn = "country";
	private String variantColumn = "variant";
	private String keyColumn = "messageKey";
	private String messageColumn = "message";
	private String tableName = "message";

	private final MessageExtractor extractor = new MessageExtractor();
	
	public JdbcMessageProvider(){
		
	}
	public JdbcMessageProvider(DataSource dataSource){
		Assert.notNull(dataSource, "dataSource must not be null");
		this.template = new JdbcTemplate(dataSource);
	}
	
	public void setDataSource(DataSource dataSource){
		Assert.notNull(dataSource, "dataSource must not be null");
		this.template = new JdbcTemplate(dataSource);
	}
	
	public Messages getMessages() {
		String query = String.format(QUERY_SELECT_MESSAGES, languageColumn,
				countryColumn, variantColumn, keyColumn,
				messageColumn, tableName, languageColumn,
				countryColumn);
		Messages messages = null;
		try{
		messages = template.query(query, new Object[] {}, extractor);
		} catch(Exception ex){
			logger.info("Cannot load messages.");
		}
		return messages;
	}

	class MessageExtractor implements ResultSetExtractor<Messages> {
		public Messages extractData(ResultSet rs) throws SQLException, DataAccessException {

			Messages messages = new Messages();

			while (rs.next()) {
				String language = rs.getString(languageColumn);
				String country = rs.getString(countryColumn);
				String variant = rs.getString(variantColumn);
				String key = rs.getString(keyColumn);
				String message = rs.getString(messageColumn);

				Locale locale = LocaleHelpers.toLocale(language, country, variant);
				messages.addMessage(locale.toString(), key, message);
			}

			return messages;
		}
	}
}
