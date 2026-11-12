package com.acc.boot.config.properties;

public class Database {
	private String url;
	private String userName;
	private String password;
	private String driverClassName;
	private String dialect;
	private Boolean showSql = false;

	public Database() {

	}

	public Boolean getShowSql() {
		return showSql;
	}

	public void setShowSql(Boolean showSql) {
		this.showSql = showSql;
	}

	public String getUrl() {
		return url;
	}

	public void setUrl(String url) {
		this.url = url;
	}

	public String getUserName() {
		return userName;
	}

	public void setUserName(String userName) {
		this.userName = userName;
	}

	public String getPassword() {
		return password;
	}

	public void setPassword(String password) {
		this.password = password;
	}

	public String getDriverClassName() {
		return driverClassName;
	}

	public void setDriverClassName(String driverClassName) {
		this.driverClassName = driverClassName;
	}

	public String getDialect() {
		return dialect;
	}

	public void setDialect(String dialect) {
		this.dialect = dialect;
	}
}