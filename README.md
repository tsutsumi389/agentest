# agentest

coding agent(claude code, codex cli, github copilot, gemini cli)から使うことに特化したテスト管理ツール
coding agentからのテストケースの作成、テストの実行が可能（MCPで連携）
人間がcoding agentが作成したテストケースのレビューやテスト結果の実施をwebUIを使って確認する

テストケースは、coding agentがどこを修正したかが特定できないといけないので履歴管理を行う
テスト実施は、何度も再実施が可能で実行結果は履歴としてのこす

githubのようなユーザー管理でサービスを提供する
