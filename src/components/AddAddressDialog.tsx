
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription
} from "@/components/ui/dialog";
import { useUser, useFirestore, addDocumentNonBlocking } from "@/firebase";
import { collection } from "firebase/firestore";
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
  const firestore = useFirestore();
  const { user } = useUser();

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

  const onSubmit = (data: AddressFormValues) => {
    // In demo mode, we use a static ID if the user is not logged in
    const userId = user?.uid || 'user-demo-id';
    if (!userId || !firestore) {
        toast({ title: "Error", description: "No se pudo conectar a la base de datos.", variant: "destructive" });
        return;
    }
    
    setIsSaving(true);
    const addressesRef = collection(firestore, 'users', userId, 'addresses');
    addDocumentNonBlocking(addressesRef, data);

    toast({
        title: "¡Dirección Añadida!",
        description: "Tu nueva dirección ha sido añadida a tu perfil.",
    });
    form.reset();
    onAddressAdded?.(); // Call the callback function
    setOpen(false); // Close the dialog
    setIsSaving(false);
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
