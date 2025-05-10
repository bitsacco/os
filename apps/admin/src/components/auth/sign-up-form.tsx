"use client";

import * as React from "react";
import RouterLink from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Controller, useForm } from "react-hook-form";
import { z as zod } from "zod";

import { paths } from "@/paths";
import { authClient } from "@/lib/auth/client";
import { useUser } from "@/hooks/use-user";
import { PhoneInput } from "./PhoneInput";
import { PinInput } from "./PinInput";

const schema = zod
  .object({
    phone: zod.string().optional(),
    npub: zod.string().optional(),
    pin: zod
      .string()
      .min(6, { message: "PIN should be exactly 6 digits" })
      .max(6, { message: "PIN should be exactly 6 digits" }),
    terms: zod
      .boolean()
      .refine((value) => value, "You must accept the terms and conditions"),
  })
  .refine((data) => data.phone || data.npub, {
    message: "Either phone number or Nostr public key is required",
    path: ["phone"],
  });

type Values = zod.infer<typeof schema>;

const defaultValues = {
  phone: "+254",
  npub: "",
  pin: "",
  terms: false,
} satisfies Values;

export function SignUpForm(): React.JSX.Element {
  const router = useRouter();

  const { checkSession } = useUser();

  const [isPending, setIsPending] = React.useState<boolean>(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({ defaultValues, resolver: zodResolver(schema) });

  const onSubmit = React.useCallback(
    async (values: Values): Promise<void> => {
      setIsPending(true);

      const { error } = await authClient.signUp({
        pin: values.pin,
        phone: values.phone || undefined,
        npub: values.npub || undefined,
      });

      if (error) {
        setError("root", { type: "server", message: error });
        setIsPending(false);
        return;
      }

      // Refresh the auth state
      await checkSession?.();

      // UserProvider, for this case, will not refresh the router
      // After refresh, GuestGuard will handle the redirect
      router.refresh();
    },
    [checkSession, router, setError],
  );

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4">Sign up</Typography>
        <Typography color="text.secondary" variant="body2">
          Already have an account?{" "}
          <Link
            component={RouterLink}
            href={paths.auth.signIn}
            underline="hover"
            variant="subtitle2"
          >
            Sign in
          </Link>
        </Typography>
      </Stack>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={3}>
          <Controller
            control={control}
            name="phone"
            render={({ field: { value, onChange, ...restField } }) => (
              <PhoneInput
                value={value || ""}
                onChange={onChange}
                error={errors.phone?.message}
                label="Phone number (required if no npub)"
                {...restField}
              />
            )}
          />
          <Controller
            control={control}
            name="npub"
            render={({ field }) => (
              <FormControl error={Boolean(errors.npub)}>
                <InputLabel>Nostr Public Key (npub)</InputLabel>
                <OutlinedInput
                  {...field}
                  label="Nostr Public Key (npub)"
                  placeholder="Required if no phone number"
                />
                {errors.npub ? (
                  <FormHelperText>{errors.npub.message}</FormHelperText>
                ) : null}
              </FormControl>
            )}
          />
          <Controller
            control={control}
            name="pin"
            render={({ field: { value, onChange, ...restField } }) => (
              <PinInput
                value={value || ""}
                onChange={onChange}
                error={errors.pin?.message}
                label="PIN (6 digits)"
                {...restField}
              />
            )}
          />
          <Controller
            control={control}
            name="terms"
            render={({ field }) => (
              <div>
                <FormControlLabel
                  control={<Checkbox {...field} />}
                  label={
                    <React.Fragment>
                      I have read the <Link>terms and conditions</Link>
                    </React.Fragment>
                  }
                />
                {errors.terms ? (
                  <FormHelperText error>{errors.terms.message}</FormHelperText>
                ) : null}
              </div>
            )}
          />
          {errors.root ? (
            <Alert color="error">{errors.root.message}</Alert>
          ) : null}
          <Button disabled={isPending} type="submit" variant="contained">
            Sign up
          </Button>
        </Stack>
      </form>
      <Alert color="warning">
        You will need to verify your phone number or Nostr public key after
        registration.
      </Alert>
    </Stack>
  );
}
