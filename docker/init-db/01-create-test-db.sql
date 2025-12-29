-- テスト用データベースの作成
-- PostgreSQLコンテナ初回起動時に自動実行される

CREATE DATABASE agentest_test;
GRANT ALL PRIVILEGES ON DATABASE agentest_test TO agentest;
