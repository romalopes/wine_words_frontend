import { useCallback, useEffect, useState } from "react";
import type { DragEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, Checkbox, Chip, Input, Spinner, Tabs } from "@heroui/react";
import PageHero from "./PageHero";
import { categoriesApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { canManageWinesRole } from "../constants/roles";
import { errorMessage } from "../utils/errors";
import type { Category, CategoryFlag } from "../types/catalog";

interface CategoryTab {
  key: "wine" | "review" | "article"
  label: string
  sortKey: "sort_order_wine" | "sort_order_review" | "sort_order_article"
  flag: CategoryFlag
}

const TYPE_TABS = [
  { key: "wine", label: "Wine categories", sortKey: "sort_order_wine", flag: "for_wine" },
  { key: "review", label: "Review categories", sortKey: "sort_order_review", flag: "for_review" },
  { key: "article", label: "Article categories", sortKey: "sort_order_article", flag: "for_article" },
] as const satisfies readonly CategoryTab[];

interface CategoryForm {
  name: string
  for_wine: boolean
  for_review: boolean
  for_article: boolean
}

const emptyForm: CategoryForm = {
  name: "",
  for_wine: false,
  for_review: false,
  for_article: false,
};

function Categories() {
  const { user } = useAuth();
  const canManage = canManageWinesRole(user);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"wine" | "review" | "article">("wine");
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await categoriesApi.list();
      setCategories(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load categories"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  function updateField<K extends keyof CategoryForm>(field: K, value: CategoryForm[K]) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function resetForm() {
    setMode("create");
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        name: form.name.trim(),
        for_wine: form.for_wine,
        for_review: form.for_review,
        for_article: form.for_article,
      };
      if (mode === "edit" && editingId) {
        await categoriesApi.update(editingId, payload);
        setNotice(`Category "${payload.name}" updated.`);
      } else {
        await categoriesApi.create(payload);
        setNotice(`Category "${payload.name}" created.`);
      }
      resetForm();
      await loadCategories();
    } catch (err) {
      setError(errorMessage(err, "Failed to save category"));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(category: Category) {
    setMode("edit");
    setEditingId(category.id);
    setForm({
      name: category.name || "",
      for_wine: !!category.for_wine,
      for_review: !!category.for_review,
      for_article: !!category.for_article,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(category: Category) {
    const message = `Delete category "${category.name}"? This cannot be undone.`;
    if (!window.confirm(message)) return;

    setError(null);
    setNotice(null);
    try {
      await categoriesApi.remove(category.id);
      setNotice(`Category "${category.name}" deleted.`);
      if (editingId === category.id) resetForm();
      await loadCategories();
    } catch (err) {
      setError(errorMessage(err, "Failed to delete category"));
    }
  }

  const tab = TYPE_TABS.find((item) => item.key === activeTab) ?? TYPE_TABS[0];
  const tabCategories = categories
    .filter((category) => category[tab.flag])
    .sort((first, second) => (first[tab.sortKey] ?? 9999) - (second[tab.sortKey] ?? 9999));

  function handleDragStart(category: Category) {
    setDragId(category.id);
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>, category: Category) {
    event.preventDefault();
    setDragOverId(category.id);
  }

  function handleDragLeave() {
    setDragOverId(null);
  }

  async function handleDrop(event: DragEvent<HTMLLIElement>, targetCategory: Category) {
    event.preventDefault();
    setDragOverId(null);
    const sourceId = dragId;
    setDragId(null);
    if (!sourceId || sourceId === targetCategory.id) return;

    const ids = tabCategories.map((category) => category.id);
    const fromIndex = ids.indexOf(sourceId);
    const toIndex = ids.indexOf(targetCategory.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = ids.splice(fromIndex, 1);
    if (moved === undefined) return;
    ids.splice(toIndex, 0, moved);

    setCategories((previous) =>
      previous.map((category) => {
        const index = ids.indexOf(category.id);
        return index === -1 ? category : { ...category, [tab.sortKey]: index + 1 };
      }),
    );

    try {
      await categoriesApi.reorder(tab.key, ids);
      setNotice(`Order saved for ${tab.label.toLowerCase()}.`);
    } catch (err) {
      setError(errorMessage(err, "Failed to save new order"));
    }
    await loadCategories();
  }

  return (
    <main className="wine-app hero-settings-page">
      <PageHero
        kicker="Settings"
        title="Categories"
        description="Manage the editorial categories used to organise wines, reviews, and articles."
      />

      <div className="hero-settings-messages" aria-live="polite">
        {notice && (
          <Alert status="success">
            <Alert.Content>
              <Alert.Title>Saved</Alert.Title>
              <Alert.Description>{notice}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        {error && (
          <Alert status="danger">
            <Alert.Content>
              <Alert.Title>Something went wrong</Alert.Title>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </div>

      <div className="category-library-layout">
        <Card className="category-library-form-card">
          <Card.Header>
            <div>
              <span className="source-library-card__eyebrow">Category editor</span>
              <Card.Title>{mode === "edit" ? "Edit category" : "Create a category"}</Card.Title>
              <Card.Description>
                Choose where the category appears. A category can organise more than one content type.
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            {canManage ? (
              <form className="category-library-form" onSubmit={handleSubmit}>
                <div className="category-form__row">
                  <label htmlFor="category-name">Name</label>
                  <Input
                    id="category-name"
                    type="text"
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    placeholder="e.g. Red blends"
                    fullWidth
                  />
                </div>
                <fieldset className="category-library-form__toggles">
                  <legend>Applies to</legend>
                  {TYPE_TABS.map((item) => (
                    <Checkbox
                      key={item.flag}
                      isSelected={form[item.flag]}
                      onChange={(checked) => updateField(item.flag, checked)}
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator>✓</Checkbox.Indicator>
                        </Checkbox.Control>
                        {item.flag.replace("for_", "").replace(/^\w/, (letter) => letter.toUpperCase())}
                      </Checkbox.Content>
                    </Checkbox>
                  ))}
                </fieldset>
                <div className="category-form__actions">
                  <Button type="submit" variant="primary" isDisabled={saving}>
                    {saving ? "Saving…" : mode === "edit" ? "Update category" : "Create category"}
                  </Button>
                  {mode === "edit" && (
                    <Button type="button" variant="ghost" onPress={resetForm}>
                      Cancel edit
                    </Button>
                  )}
                </div>
              </form>
            ) : (
              <p className="wine-management__hint">Only Admin and Editor can manage categories.</p>
            )}
          </Card.Content>
        </Card>

        <Card className="category-library-list-card">
          <Card.Header>
            <div>
              <span className="source-library-card__eyebrow">Category library</span>
              <Card.Title>Display order</Card.Title>
              <Card.Description>
                Drag and drop to reorder. Every move is saved immediately.
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as "wine" | "review" | "article")}
              variant="secondary"
            >
              <Tabs.List aria-label="Category types">
                {TYPE_TABS.map((item) => (
                  <Tabs.Tab key={item.key} id={item.key}>
                    {item.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>

            {loading ? (
              <div className="hero-settings-state" role="status">
                <Spinner color="accent" />
                <span>Loading categories…</span>
              </div>
            ) : tabCategories.length === 0 ? (
              <div className="hero-settings-empty hero-settings-empty--inline">
                <p>No categories for this type yet.</p>
              </div>
            ) : (
              <ul className="category-library-list">
                {tabCategories.map((category) => (
                  <li
                    key={category.id}
                    className={`category-library-list__item${dragOverId === category.id ? " category-library-list__item--over" : ""}${dragId === category.id ? " category-library-list__item--dragging" : ""}`}
                    draggable={canManage}
                    onDragStart={canManage ? () => handleDragStart(category) : undefined}
                    onDragOver={canManage ? (event) => handleDragOver(event, category) : undefined}
                    onDragLeave={canManage ? handleDragLeave : undefined}
                    onDrop={canManage ? (event) => handleDrop(event, category) : undefined}
                    onDragEnd={canManage ? () => {
                      setDragId(null);
                      setDragOverId(null);
                    } : undefined}
                  >
                    {canManage && (
                      <span className="category-library-list__handle" aria-hidden="true">⠿</span>
                    )}
                    <Chip color="accent" variant="soft" size="sm">
                      {category[tab.sortKey] ?? "—"}
                    </Chip>
                    <span className="category-library-list__name">
                      <Link to={`/categories/${category.slug}`}>{category.name}</Link>
                    </span>
                    {canManage && (
                      <div className="category-library-list__actions">
                        <Button size="sm" variant="ghost" onPress={() => startEdit(category)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger-soft" onPress={() => handleDelete(category)}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card.Content>
        </Card>
      </div>
    </main>
  );
}

export default Categories;