import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { projectsApi, ApiError, type Project } from '../../lib/api';
import { toast } from '../../stores/toast';

interface ProjectGeneralSettingsProps {
  project: Project;
  onUpdated: (project: Project) => void;
}

/**
 * プロジェクト一般設定コンポーネント
 */
export function ProjectGeneralSettings({ project, onUpdated }: ProjectGeneralSettingsProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // プロジェクトデータが変更されたらフォームをリセット
  useEffect(() => {
    setName(project.name);
    setDescription(project.description || '');
    setErrors({});
  }, [project]);

  const hasChanges = name !== project.name || description !== (project.description || '');

  // 入力値を元に戻す
  const handleCancel = () => {
    setName(project.name);
    setDescription(project.description || '');
    setErrors({});
  };

  // バリデーション
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'プロジェクト名は必須です';
    } else if (name.length > 100) {
      newErrors.name = 'プロジェクト名は100文字以内で入力してください';
    }

    if (description.length > 500) {
      newErrors.description = '説明は500文字以内で入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSaving(true);
    setErrors({});

    try {
      const response = await projectsApi.update(project.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });

      onUpdated(response.project);
      toast.success('プロジェクト情報を更新しました');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) {
          const fieldErrors: Record<string, string> = {};
          for (const [field, messages] of Object.entries(err.details)) {
            fieldErrors[field] = messages[0];
          }
          setErrors(fieldErrors);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error('プロジェクト情報の更新に失敗しました');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">一般設定</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* プロジェクト名 */}
        <div>
          <label htmlFor="project-name" className="block text-sm font-medium text-foreground mb-1">
            プロジェクト名 <span className="text-danger">*</span>
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((prev) => ({ ...prev, name: '' }));
            }}
            className={`input w-full max-w-md ${errors.name ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
            disabled={isSaving}
          />
          {errors.name && <p className="text-xs text-danger mt-1">{errors.name}</p>}
        </div>

        {/* 説明 */}
        <div>
          <label
            htmlFor="project-description"
            className="block text-sm font-medium text-foreground mb-1"
          >
            説明
          </label>
          <textarea
            id="project-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setErrors((prev) => ({ ...prev, description: '' }));
            }}
            rows={3}
            className={`input w-full max-w-md resize-none ${errors.description ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
            disabled={isSaving}
            placeholder="プロジェクトの説明（任意）"
          />
          {errors.description && <p className="text-xs text-danger mt-1">{errors.description}</p>}
        </div>

        {/* 所属組織（読み取り専用） */}
        {project.organization && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">所属組織</label>
            <input
              type="text"
              value={project.organization.name}
              disabled
              className="input w-full max-w-md bg-background-tertiary"
            />
            <p className="text-xs text-foreground-subtle mt-1">所属組織は変更できません</p>
          </div>
        )}

        {/* ボタン */}
        <div className="pt-4 flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={isSaving || !hasChanges}>
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? '保存中...' : '保存'}
          </button>
          {hasChanges && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCancel}
              disabled={isSaving}
            >
              キャンセル
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
