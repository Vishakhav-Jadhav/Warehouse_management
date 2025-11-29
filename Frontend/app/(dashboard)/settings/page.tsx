'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Save, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Category {
  _id: string;
  name: string;
  type: string;
}

export default function SettingsPage() {
  const [generalSettings, setGeneralSettings] = useState({
    currency: 'USD',
    timezone: 'UTC',
    itemsPerPage: 20
  });
  const [apiConfig, setApiConfig] = useState({ mapsApiKey: '' });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', type: 'Equipment' });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategory, setEditCategory] = useState({ name: '', type: 'Equipment' });

  // Fetch data on mount
  useEffect(() => {
    fetchSettings();
    fetchCategories();
    fetchApiConfig();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5001/api/settings/general', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setGeneralSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5001/api/settings/categories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApiConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5001/api/settings/api-config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setApiConfig(data);
      }
    } catch (error) {
      console.error('Error fetching API config:', error);
    }
  };

  const saveGeneralSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Saving general settings:', generalSettings);
      const response = await fetch('http://localhost:5001/api/settings/general', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(generalSettings)
      });
      console.log('Response status:', response.status);
      const responseData = await response.json();
      console.log('Response data:', responseData);

      if (response.ok) {
        toast.success('✅ General settings saved successfully!');
        return true;
      } else {
        toast.error(`❌ Failed to save general settings: ${responseData.message || 'Unknown error'}`);
        return false;
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('❌ Error saving settings');
      return false;
    }
  };

  const saveApiConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Saving API config:', apiConfig);
      const response = await fetch('http://localhost:5001/api/settings/api-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(apiConfig)
      });
      console.log('API Config Response status:', response.status);
      const responseData = await response.json();
      console.log('API Config Response data:', responseData);

      if (response.ok) {
        toast.success('✅ API configuration saved successfully!');
        return true;
      } else {
        toast.error(`❌ Failed to save API configuration: ${responseData.message || 'Unknown error'}`);
        return false;
      }
    } catch (error) {
      console.error('Error saving API config:', error);
      toast.error('❌ Error saving API configuration');
      return false;
    }
  };

  const addCategory = async () => {
    if (!newCategory.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5001/api/settings/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newCategory)
      });
      if (response.ok) {
        const category = await response.json();
        setCategories([...categories, category]);
        setNewCategory({ name: '', type: 'Equipment' });
        setDialogOpen(false);
        toast.success('Category added successfully');
      } else {
        toast.error('Failed to add category');
      }
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error('Error adding category');
    }
  };

  const updateCategory = async () => {
    if (!editCategory.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5001/api/settings/categories/${editingCategory!._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editCategory)
      });
      if (response.ok) {
        const updated = await response.json();
        setCategories(categories.map(cat => cat._id === updated._id ? updated : cat));
        setDialogOpen(false);
        setIsEditing(false);
        setEditingCategory(null);
        toast.success('Category updated successfully');
      } else {
        toast.error('Failed to update category');
      }
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Error updating category');
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5001/api/settings/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setCategories(categories.filter(cat => cat._id !== id));
        toast.success('Category deleted successfully');
      } else {
        toast.error('Failed to delete category');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Error deleting category');
    }
  };

  const handleSaveAll = async () => {
    console.log('Save button clicked - attempting to save settings');

    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('❌ You must be logged in to save settings');
      console.error('No authentication token found');
      return;
    }

    toast.info('💾 Saving settings...');

    setSaving(true);
    try {
      const [generalSuccess, apiSuccess] = await Promise.all([
        saveGeneralSettings(),
        saveApiConfig()
      ]);

      if (generalSuccess && apiSuccess) {
        toast.success('🎉 All settings saved successfully!', {
          duration: 3000,
        });
      } else {
        toast.warning('⚠️ Some settings may not have saved. Check console for details.');
      }
    } catch (error) {
      console.error('Save operation failed:', error);
      toast.error('❌ Failed to save settings. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure application preferences
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={generalSettings.currency}
                onValueChange={(value) => setGeneralSettings({...generalSettings, currency: value})}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={generalSettings.timezone}
                onValueChange={(value) => setGeneralSettings({...generalSettings, timezone: value})}
              >
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="EST">Eastern Time</SelectItem>
                  <SelectItem value="PST">Pacific Time</SelectItem>
                  <SelectItem value="CST">Central Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="items-per-page">Items Per Page</Label>
              <Input
                id="items-per-page"
                type="number"
                value={generalSettings.itemsPerPage}
                onChange={(e) => setGeneralSettings({...generalSettings, itemsPerPage: parseInt(e.target.value)})}
                min="10"
                max="100"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categories.map((category) => (
                <div key={category._id} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm">{category.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-1 text-xs ${
                      category.type === 'Equipment' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {category.type}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setIsEditing(true); setEditingCategory(category); setEditCategory({ name: category.name, type: category.type }); setDialogOpen(true); }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCategory(category._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="mt-4 w-full" onClick={() => { setIsEditing(false); setNewCategory({ name: '', type: 'Equipment' }); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isEditing ? 'Edit Category' : 'Add New Category'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="category-name">Category Name</Label>
                    <Input
                      id="category-name"
                      value={isEditing ? editCategory.name : newCategory.name}
                      onChange={(e) => isEditing ? setEditCategory({...editCategory, name: e.target.value}) : setNewCategory({...newCategory, name: e.target.value})}
                      placeholder="Enter category name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category-type">Category Type</Label>
                    <Select
                      value={isEditing ? editCategory.type : newCategory.type}
                      onValueChange={(value) => isEditing ? setEditCategory({...editCategory, type: value}) : setNewCategory({...newCategory, type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Equipment">Equipment</SelectItem>
                        <SelectItem value="Spare Parts">Spare Parts</SelectItem>
                        <SelectItem value="Accessories">Accessories</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={isEditing ? updateCategory : addCategory}>
                      {isEditing ? 'Update' : 'Add'} Category
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="maps-api">Maps API Key</Label>
              <Input
                id="maps-api"
                type="password"
                value={apiConfig.mapsApiKey}
                onChange={(e) => setApiConfig({ mapsApiKey: e.target.value })}
                placeholder="Enter API key"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSaveAll} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
