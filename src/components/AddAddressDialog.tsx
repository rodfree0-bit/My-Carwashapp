"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { db, auth } from "@/config/firebase";
import { collection, addDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PlusCircle } from "lucide-react";

const addressSchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio."),
    street: z.string().min(1, "La calle es obligatoria."),
    city: z.string().min(1, "La ciudad es obligatoria."),
    state: z.string().min(1, "El estado es obligatorio."),
    zipCode: z.string().min(1, "El código postal es obligatorio."),
});

type AddressFormValues = z.infer<typeof addressSchema>;

export function AddAddressDialog({ children, onAddressAdded }: { children?: React.ReactNode, onAddressAdded?: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const form = useForm<AddressFormValues>({
      resolver: zodResolver(addressSchema),
      defaultValues: {
          name: "",
          street: "",
          city: "",
          state: "",
          zipCode: "",
      }
  });

  const onSubmit = async (data: AddressFormValues) => {
    const user = auth.currentUser;
    if (!user) {
      toast({ title: "Error", description: "No autenticado" });
      return;
    }
    setIsSaving(true);
    try {
      await addDoc(collection(db, "addresses"), {
        ...data,
        userId: user.uid,
        createdAt: new Date()
      });
      toast({ title: "¡Dirección Añadida!", description: "Tu nueva dirección ha sido añadida a tu perfil." });
      form.reset();
      onAddressAdded?.();
      setOpen(false);
    } catch (error) {
      toast({ title: "Error", description: "Ocurrió un error al añadir la dirección.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
      <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
              {children || <Button variant="outline" size="sm" className="gap-1"><PlusCircle className="size-3.5" />Añadir Dirección</Button>}
          </DialogTrigger>
          <DialogContent className="sm:max-w-md grid-rows-[auto,1fr,auto] max-h-[90vh]">
              <DialogHeader>
                  <DialogTitle>Añadir una Nueva Dirección</DialogTitle>
                  <DialogDescription>
                    Esta dirección se guardará en tu perfil para futuros usos.
                  </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto pr-6">
              <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Nombre</FormLabel>
                                  <FormControl><Input placeholder="e.g. Casa, Trabajo" {...field} /></FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                      <FormField
                          control={form.control}
                          name="street"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Calle</FormLabel>
                                  <FormControl><Input placeholder="e.g. 123 Main St" {...field} /></FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                      <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Ciudad</FormLabel>
                                  <FormControl><Input placeholder="e.g. Anytown" {...field} /></FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                       <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="state"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Estado</FormLabel>
                                    <FormControl><Input placeholder="e.g. CA" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="zipCode"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Código Postal</FormLabel>
                                    <FormControl><Input placeholder="e.g. 12345" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                       </div>
                      <DialogFooter className="sticky bottom-0 bg-background py-4">
                          <DialogClose asChild>
                              <Button type="button" variant="secondary" disabled={isSaving}>Cancelar</Button>
                          </DialogClose>
                          <Button type="submit" disabled={isSaving}>
                            {isSaving ? 'Añadiendo...' : 'Añadir Dirección'}
                          </Button>
                      </DialogFooter>
                  </form>
              </Form>
              </div>
          </DialogContent>
      </Dialog>
  )
}
